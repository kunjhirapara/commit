import { NextResponse } from "next/server";
import { getValidatedServerEnv } from "@/lib/env";
import { getAuthReadiness } from "@/lib/auth/readiness";
import { getBuildVersion } from "@/lib/buildInfo";

export async function GET() {
  // Reported on both branches. An unhealthy container is exactly when knowing
  // which build is running matters most, and the rollout check in the Deploy
  // workflow must be able to tell "the old image is still up" apart from "the
  // new image is up and failing".
  const version = getBuildVersion();

  try {
    const env = getValidatedServerEnv();

    /**
     * Whether anyone can actually sign in.
     *
     * Not covered by the flags below, all of which predate Auth.js. An image
     * that switches sign-in to Auth.js can reach a deployment before anyone
     * sets the Auth.js variables, and the result is an app that boots, serves
     * pages and reports healthy while nobody can log in.
     *
     * Reported as a bare boolean on purpose. This endpoint is public — the
     * container healthcheck polls it with no session — and publishing the names
     * of the secrets a deployment is missing is a map for anyone probing it.
     * The names go to the server log instead, where an operator can act on them.
     */
    const auth = getAuthReadiness(process.env);

    if (!auth.ready) {
      console.error(
        `[health] auth is not configured; sign-in will fail. Missing: ${auth.missing.join(", ")}`,
      );
    }

    return NextResponse.json({
      status: "healthy",
      version,
      checkedAt: new Date().toISOString(),
      integrations: {
        clerk: !!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        convex: !!env.NEXT_PUBLIC_CONVEX_URL,
        stream: !!env.NEXT_PUBLIC_STREAM_API_KEY && !!env.STREAM_SECRET_KEY,
        webhooks: !!env.CLERK_WEBHOOK_SECRET,
        auth: auth.ready,
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
