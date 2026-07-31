import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { findRouteRule, isPublicRoute, type AppRole } from "@/lib/routeAccess";

const CORRELATION_HEADER = "x-correlation-id";
const CORRELATION_COOKIE = "commit-correlation-id";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  const rule = findRouteRule(pathname);

  // Auth is enforced here rather than by a <SignedIn> wrapper in the root layout,
  // so that public routes (landing page, legal pages) can actually render for
  // signed-out visitors instead of bouncing straight to Clerk.
  if (!rule && !isPublicRoute(pathname)) {
    await auth.protect();
  }

  if (rule) {
    const homeUrl = new URL("/", req.url);
    const { userId, getToken } = await auth();

    if (!userId) return NextResponse.redirect(homeUrl);

    let role: AppRole | undefined;
    try {
      const token = await getToken({ template: "convex" });
      if (!token || !CONVEX_URL) return NextResponse.redirect(homeUrl);

      const convex = new ConvexHttpClient(CONVEX_URL);
      convex.setAuth(token);
      const user = await convex.query(api.users.getCurrentUser);
      role = user?.role as AppRole | undefined;
    } catch {
      return NextResponse.redirect(homeUrl);
    }

    if (!role || !rule.allowedRoles.includes(role)) {
      return NextResponse.redirect(homeUrl);
    }
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
