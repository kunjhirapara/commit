"use client";

import Link from "next/link";
import { CodeIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Chrome for the sign-in and sign-up pages.
 *
 * Deliberately thin. The first version added a card, a heading and a subtitle
 * around `<SignIn />`, which already renders all three — the result was a card
 * inside a card and the page saying "Sign in" directly above "Sign in to
 * Commit". Clerk owns the form and its framing; this owns the wordmark, the
 * centring and the legal line, and nothing that Clerk also draws.
 *
 * Not `AppShell` either: a full app navbar carrying its own "Sign in" button, on
 * the sign-in page, is noise.
 */
function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-10">
      <Link
        href="/"
        className="flex items-center gap-2 font-mono text-2xl font-bold text-primary transition-opacity hover:opacity-80">
        <CodeIcon className="size-7" aria-hidden="true" />
        <span>Commit</span>
      </Link>

      <div className="w-full max-w-[400px]">{children}</div>

      <p className="max-w-[400px] text-center text-xs text-muted-foreground">
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
  );
}

export default AuthPageShell;
