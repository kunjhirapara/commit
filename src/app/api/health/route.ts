import { NextResponse } from "next/server";
import { getValidatedServerEnv } from "@/lib/env";
import { getBuildVersion } from "@/lib/buildInfo";

export async function GET() {
  // Reported on both branches. An unhealthy container is exactly when knowing
  // which build is running matters most, and the rollout check in the Deploy
  // workflow must be able to tell "the old image is still up" apart from "the
  // new image is up and failing".
  const version = getBuildVersion();

  try {
    const env = getValidatedServerEnv();

    return NextResponse.json({
      status: "healthy",
      version,
      checkedAt: new Date().toISOString(),
      integrations: {
        clerk: !!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        convex: !!env.NEXT_PUBLIC_CONVEX_URL,
        stream: !!env.NEXT_PUBLIC_STREAM_API_KEY && !!env.STREAM_SECRET_KEY,
        webhooks: !!env.CLERK_WEBHOOK_SECRET,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        version,
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : "Health check failed.",
      },
      { status: 503 },
    );
  }
}
