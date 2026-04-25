import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import { getValidatedServerEnv } from "@/lib/env";
import { isServerFeatureEnabled } from "@/lib/featureFlags";
import {
  consumeRateLimit,
  getRateLimitHeaders,
  getRateLimitKey,
} from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  try {
    if (!isServerFeatureEnabled("telemetryIngestion")) {
      return NextResponse.json({ ok: true, skipped: "disabled" }, { status: 202 });
    }

    if (isServerFeatureEnabled("strictApiRateLimiting")) {
      const rateLimit = consumeRateLimit({
        key: getRateLimitKey("telemetry", request),
        limit: 60,
        windowMs: 60_000,
      });

      if (!rateLimit.allowed) {
        return NextResponse.json(
          { ok: false, error: "Rate limit exceeded" },
          { status: 429, headers: getRateLimitHeaders(rateLimit) },
        );
      }
    }

    const { getToken } = await auth();
    const token = await getToken({ template: "convex" });
    const body = await request.json();
    const env = getValidatedServerEnv();

    await fetchMutation(
      api.observability.ingestTelemetry,
      {
        source: body.source,
        scope: body.scope,
        level: body.level,
        message: body.message,
        requestId: body.requestId,
        correlationId:
          body.correlationId ?? request.headers.get("x-correlation-id") ?? undefined,
        interviewId: body.interviewId,
        streamCallId: body.streamCallId,
        provider: body.provider,
        status: body.status,
        metadata: body.metadata,
      },
      {
        token: token ?? undefined,
        url: env.NEXT_PUBLIC_CONVEX_URL,
      },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[telemetry-route]", error);
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
