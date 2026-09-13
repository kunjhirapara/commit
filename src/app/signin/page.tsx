"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import AuthPageShell from "@/components/auth/AuthPageShell";
import RedirectAwayFromAuth from "@/components/auth/RedirectAwayFromAuth";
import SignInForm from "@/components/auth/SignInForm";
import { SignedIn } from "@/components/auth/SessionGuards";
import { Skeleton } from "@/components/ui/skeleton";
import { safeRedirectTarget } from "@/lib/auth/redirectTarget";

function SignInContent() {
  const searchParams = useSearchParams();

  // Middleware attaches redirect_url when it bounces a signed-out visitor, so a
  // session that expired on /dashboard comes back to /dashboard. The guard is
  // in its own tested module: an open redirect here inherits the trust of the
  // page the user has just typed their password into.
  const redirectTo = safeRedirectTarget(searchParams.get("redirect_url"));

  return <SignInForm redirectTo={redirectTo} />;
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
      <Suspense fallback={<Skeleton className="h-[28rem] w-full rounded-2xl" />}>
        <SignInContent />
      </Suspense>
    </AuthPageShell>
  );
}
