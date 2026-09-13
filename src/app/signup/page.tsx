"use client";

import AuthPageShell from "@/components/auth/AuthPageShell";
import RedirectAwayFromAuth from "@/components/auth/RedirectAwayFromAuth";
import SignUpForm from "@/components/auth/SignUpForm";
import { SignedIn } from "@/components/auth/SessionGuards";

/**
 * Mirror of /signin.
 *
 * Deliberately does not read `redirect_url`: someone signing up for the first
 * time has no prior location worth returning to, and the home page shows the
 * first-run onboarding.
 *
 * No Suspense boundary, unlike /signin — this page reads no search params, so
 * there is nothing to suspend on.
 */
export default function SignUpPage() {
  return (
    <AuthPageShell>
      <SignedIn>
        <RedirectAwayFromAuth />
      </SignedIn>

      <SignUpForm redirectTo="/" />
    </AuthPageShell>
  );
}
