"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import AuthPageShell from "@/components/auth/AuthPageShell";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Password reset, both halves.
 *
 * Public: everyone reaching it is, by definition, unable to sign in. It is
 * listed in PUBLIC_ROUTES for that reason, and forgetting to do so would make
 * the route redirect to /signin — where the only link out is back to here.
 */

function ResetPasswordContent() {
  const searchParams = useSearchParams();

  return (
    <ResetPasswordForm
      token={searchParams.get("token")}
      emailFromLink={searchParams.get("email")}
    />
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthPageShell>
      {/*
        useSearchParams opts this subtree into client-side rendering, and
        without a Suspense boundary the production build fails outright. That
        exact failure has already happened twice in this codebase — see the
        notes on /accept-invitation and /signin.
      */}
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-2xl" />}>
        <ResetPasswordContent />
      </Suspense>
    </AuthPageShell>
  );
}
