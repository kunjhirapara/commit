"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SignIn, SignedIn } from "@clerk/nextjs";
import AuthPageShell from "@/components/auth/AuthPageShell";
import RedirectAwayFromAuth from "@/components/auth/RedirectAwayFromAuth";
import { useClerkAppearance } from "@/hooks/useClerkAppearance";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Returns the post-sign-in destination.
 *
 * Middleware attaches `redirect_url` when it bounces a signed-out visitor, and
 * honouring it is the entire point: a session that expires on /dashboard should
 * come back to /dashboard rather than dumping the user on the landing page.
 *
 * Only same-origin relative paths are accepted. `redirect_url` arrives in the
 * query string where anyone can set it, and forwarding an absolute URL after
 * login is an open redirect — a credible phishing step, because the victim has
 * just typed their password on a page that genuinely was ours.
 */
const useRedirectTarget = () => {
  const searchParams = useSearchParams();
  const requested = searchParams.get("redirect_url");

  if (!requested) return "/";
  // "//evil.com" is protocol-relative and would leave the site.
  if (!requested.startsWith("/") || requested.startsWith("//")) return "/";
  return requested;
};

function SignInContent() {
  const redirectTarget = useRedirectTarget();
  const appearance = useClerkAppearance();

  return (
    <SignIn
      appearance={appearance}
      // Hash routing keeps this working on a normal route; the alternative is a
      // catch-all segment existing purely to satisfy Clerk's path routing.
      routing="hash"
      signUpUrl="/signup"
      forceRedirectUrl={redirectTarget}
      fallbackRedirectUrl={redirectTarget}
    />
  );
}

export default function SignInPage() {
  return (
    <AuthPageShell>
      {/* Already signed in: send them on rather than showing a login form. */}
      <SignedIn>
        <RedirectAwayFromAuth />
      </SignedIn>

      {/*
        useSearchParams opts this subtree into client-side rendering, and without
        a Suspense boundary the production build fails outright. That exact
        failure has already happened once in this codebase, on
        /accept-invitation — see the note there.
      */}
      <Suspense fallback={<Skeleton className="h-[28rem] w-full rounded-xl" />}>
        <SignInContent />
      </Suspense>
    </AuthPageShell>
  );
}
