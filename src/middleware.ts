import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isPublicRoute } from "@/lib/routeAccess";

const CORRELATION_HEADER = "x-correlation-id";
const CORRELATION_COOKIE = "commit-correlation-id";

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // Authentication only. Role gating lives in RoleGuard, driven by the same
  // PROTECTED_ROUTES table (see src/lib/routeAccess.ts).
  //
  // This used to mint a Clerk JWT and then query Convex through a freshly
  // constructed ConvexHttpClient — two serial network round-trips, on a new TLS
  // connection, before any protected page could begin rendering, and repeated on
  // every client-side navigation because the RSC payload request matches this
  // middleware too. The client then resolved the same role a second time via
  // useUserRole.
  //
  // Authorization is unaffected: every Convex function re-checks with
  // requirePermission, which was always the real gate. What changes is that a
  // disallowed role is now bounced client-side, so the shell flashes briefly
  // where there used to be a clean server redirect.
  //
  // Auth is enforced here rather than by a <SignedIn> wrapper in the root layout,
  // so that public routes (landing page, legal pages) can actually render for
  // signed-out visitors instead of bouncing straight to Clerk.
  if (!isPublicRoute(pathname)) {
    await auth.protect();
  }

  const correlationId =
    req.headers.get(CORRELATION_HEADER) ?? crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(CORRELATION_HEADER, correlationId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set(CORRELATION_HEADER, correlationId);
  response.cookies.set(CORRELATION_COOKIE, correlationId, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
