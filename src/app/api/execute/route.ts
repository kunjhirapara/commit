import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { z } from "zod";
import { api } from "@/../convex/_generated/api";
import { runCodeInDocker } from "@/lib/docker-runner";
import { getValidatedServerEnv } from "@/lib/env";
import { consumeRateLimit, getRateLimitHeaders } from "@/lib/rateLimit";
import {
  RunQueueRejection,
  acquireRunSlot,
  getRunQueueStats,
} from "@/lib/runQueue";

const bodySchema = z.object({
  language: z.enum(["javascript", "python", "java"]),
  code: z
    .string()
    .min(1, "Code must not be empty.")
    .max(50_000, "Code exceeds the 50 KB limit."),
  // Accepted and ignored by the runner: the editor sends it so meeting sessions can
  // be correlated in logs. It is never used to authorize the run.
  streamCallId: z.string().optional(),
});

/**
 * Per-account quotas. Keyed on the Clerk user id rather than IP: `getRateLimitKey`
 * derives IP from `x-forwarded-for`, which a client can set freely.
 *
 * The burst window stops one person saturating the queue; the daily cap bounds total
 * container spawns per account now that signup is open to the public.
 */
const BURST_LIMIT = 10;
const BURST_WINDOW_MS = 60_000;
const DAILY_LIMIT = 200;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Records one operational event per run so the daily rollup can count execution
 * volume, failure rate and shed load. Best-effort: a telemetry outage must never
 * turn a successful run into an error for the user.
 */
async function recordRunEvent(
  token: string | null,
  status: "succeeded" | "failed" | "rejected",
  metadata: Record<string, unknown>,
) {
  try {
    const env = getValidatedServerEnv();

    await fetchMutation(
      api.observability.ingestTelemetry,
      {
        source: "server",
        scope: "code.run",
        level: status === "succeeded" ? "info" : "warn",
        message: `Code run ${status}`,
        status,
        metadata: JSON.stringify(metadata),
      },
      { token: token ?? undefined, url: env.NEXT_PUBLIC_CONVEX_URL },
    );
  } catch (error) {
    console.error("[/api/execute] telemetry failed:", error);
  }
}

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Practice mode is open to every signed-in user, so a verified email is the one
  // thing between "anyone on the internet" and "spawns containers on the host".
  const user = await currentUser();
  const emailVerified =
    user?.primaryEmailAddress?.verification?.status === "verified";

  if (!emailVerified) {
    return NextResponse.json(
      { error: "Please verify your email address before running code." },
      { status: 403 },
    );
  }

  const burst = consumeRateLimit({
    key: `execute:burst:${userId}`,
    limit: BURST_LIMIT,
    windowMs: BURST_WINDOW_MS,
  });

  if (!burst.allowed) {
    return NextResponse.json(
      { error: "Too many runs. Please wait a moment." },
      { status: 429, headers: getRateLimitHeaders(burst) },
    );
  }

  const daily = consumeRateLimit({
    key: `execute:daily:${userId}`,
    limit: DAILY_LIMIT,
    windowMs: DAILY_WINDOW_MS,
  });

  if (!daily.allowed) {
    return NextResponse.json(
      { error: "Daily run limit reached. Please try again tomorrow." },
      { status: 429, headers: getRateLimitHeaders(daily) },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 422 },
    );
  }

  const { language, code } = parsed.data;

  const convexToken = await getToken({ template: "convex" });

  let release: (() => void) | undefined;
  try {
    release = await acquireRunSlot();
  } catch (err) {
    if (err instanceof RunQueueRejection) {
      await recordRunEvent(convexToken, "rejected", {
        language,
        reason: err.reason,
        ...getRunQueueStats(),
      });

      return NextResponse.json(
        { error: err.message, queueRejection: err.reason },
        { status: 503, headers: { "Retry-After": "10" } },
      );
    }
    throw err;
  }

  const startedAt = Date.now();
  try {
    const result = await runCodeInDocker(language, code);
    const stats = getRunQueueStats();

    console.info(
      `[/api/execute] lang=${language} exit=${result.exitCode} ` +
        `ms=${result.executionMs} timedOut=${result.timedOut} ` +
        `active=${stats.active} queued=${stats.queued}`,
    );

    // A non-zero exit is usually the user's code failing its tests, which is a
    // normal outcome — only timeouts count against the runner's health.
    await recordRunEvent(
      convexToken,
      result.timedOut ? "failed" : "succeeded",
      {
        language,
        exitCode: result.exitCode,
        executionMs: result.executionMs,
        timedOut: result.timedOut,
        ...stats,
      },
    );

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution failed.";
    const errCode = (err as NodeJS.ErrnoException)?.code;
    const isInfraFailure =
      errCode === "ENOENT" ||
      errCode === "EACCES" ||
      /docker(.*)not found|Cannot connect to the Docker daemon|permission denied/i.test(
        message,
      );
    console.error("[/api/execute] Unexpected error:", message);
    await recordRunEvent(convexToken, "failed", {
      language,
      infraError: isInfraFailure,
      message,
    });

    return NextResponse.json(
      {
        stdout: "",
        stderr: isInfraFailure
          ? `Code runner is unavailable: ${message}`
          : message,
        exitCode: 1,
        timedOut: false,
        executionMs: Date.now() - startedAt,
        infraError: isInfraFailure,
      },
      { status: isInfraFailure ? 503 : 200 },
    );
  } finally {
    release?.();
  }
}
