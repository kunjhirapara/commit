import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { runCodeInDocker } from "@/lib/docker-runner";

const bodySchema = z.object({
  language: z.enum(["javascript", "python", "java"]),
  code: z
    .string()
    .min(1, "Code must not be empty.")
    .max(50_000, "Code exceeds the 50 KB limit."),
});

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_RUNS = 30;
const runHistory = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (runHistory.get(userId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT_MAX_RUNS) {
    runHistory.set(userId, recent);
    return true;
  }
  recent.push(now);
  runHistory.set(userId, recent);
  return false;
}

const MAX_CONCURRENT_RUNS = 4;
let inFlight = 0;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (isRateLimited(userId)) {
    return NextResponse.json(
      { error: "Too many runs. Please wait a moment." },
      { status: 429 },
    );
  }

  if (inFlight >= MAX_CONCURRENT_RUNS) {
    return NextResponse.json(
      { error: "Code runner is busy. Try again shortly." },
      { status: 503 },
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

  inFlight++;
  try {
    const result = await runCodeInDocker(language, code);
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
    return NextResponse.json(
      {
        stdout: "",
        stderr: isInfraFailure
          ? `Code runner is unavailable: ${message}`
          : message,
        exitCode: 1,
        timedOut: false,
        executionMs: 0,
        infraError: isInfraFailure,
      },
      { status: isInfraFailure ? 503 : 200 },
    );
  } finally {
    inFlight--;
  }
}
