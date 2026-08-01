"use client";

import Link from "next/link";
import { CodeIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Chrome for the sign-in and sign-up pages.
 *
 * Deliberately not `AppShell`. A full app navbar carrying its own "Sign in"
 * button, on the sign-in page, is noise — and the footer's product links are a
 * distraction at the moment someone is trying to get in. This keeps the
 * wordmark, so the page is recognisably the same product and there is a way
 * back, and nothing else.
 */
function AuthPageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Link
            href="/"
            className="flex items-center gap-2 font-mono text-2xl font-bold text-primary transition-opacity hover:opacity-80">
            <CodeIcon className="size-7" aria-hidden="true" />
            <span>Commit</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-sm">
          <div className="mb-5 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

export default AuthPageShell;
