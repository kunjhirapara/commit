import { NextResponse } from "next/server";
import { getValidatedServerEnv } from "@/lib/env";

export async function GET() {
  try {
    const env = getValidatedServerEnv();

    return NextResponse.json({
      status: "healthy",
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
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : "Health check failed.",
      },
      { status: 503 },
    );
  }
}
