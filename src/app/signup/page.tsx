"use client";

import { Suspense } from "react";
import { SignUp, SignedIn } from "@clerk/nextjs";
import AuthPageShell from "@/components/auth/AuthPageShell";
import RedirectAwayFromAuth from "@/components/auth/RedirectAwayFromAuth";
import { useClerkAppearance } from "@/hooks/useClerkAppearance";
import { Skeleton } from "@/components/ui/skeleton";

function SignUpContent() {
  const appearance = useClerkAppearance();

  return (
    <SignUp
      appearance={appearance}
      routing="hash"
      signInUrl="/signin"
      fallbackRedirectUrl="/"
    />
  );
}

/**
 * Mirror of /signin.
 *
 * Exists because Clerk's <SignIn /> renders a "sign up" link that needs a real
 * destination, and the navbar's "Get started" button previously had no page
 * behind it. Deliberately does not read `redirect_url`: someone signing up for
 * the first time has no prior location worth returning to, and the home page
 * shows the first-run onboarding.
 */
export default function SignUpPage() {
  return (
    <AuthPageShell>
      <SignedIn>
        <RedirectAwayFromAuth />
      </SignedIn>

      <Suspense fallback={<Skeleton className="h-[28rem] w-full rounded-xl" />}>
        <SignUpContent />
      </Suspense>
    </AuthPageShell>
  );
}
