"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { LoaderCircleIcon, MailIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GithubIcon, GoogleIcon } from "@/components/auth/ProviderIcons";
import { describeSignInError } from "@/lib/auth/signInError";

/**
 * The sign-in form.
 *
 * Replaces Clerk's hosted `<SignIn />`, which drew its own card, heading and
 * provider buttons — so this draws them, and AuthPageShell stays the thin
 * wordmark-and-legal-line wrapper it already was.
 *
 * Every credential failure produces the same message. "No account with that
 * email" and "wrong password" are the same sentence here on purpose: telling
 * them apart is a free membership oracle for anyone with a list of addresses,
 * and the server refuses to distinguish them either — see the authorize()
 * comment in src/auth.ts, which also equalises how long the two take.
 */

/** One string for every credential failure. See above. */
const GENERIC_CREDENTIAL_ERROR =
  "That email and password do not match an account.";

type Mode = "password" | "link";

export function SignInForm({
  redirectTo,
  /**
   * Auth.js error code from the query string.
   *
   * `pages.error` points back at this page, so a failed OAuth round trip
   * returns here as `?error=<code>` and nothing else. Rendering it is what
   * separates "the provider refused" from "the button did nothing".
   */
  errorCode,
}: {
  redirectTo: string;
  errorCode?: string | null;
}) {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<null | "credentials" | "link" | "oauth">(null);
  const [linkSent, setLinkSent] = useState(false);

  const busy = pending !== null;

  // An error from the redirect, shown until the user does something that could
  // clear it. A local error from a submit takes precedence, because it is the
  // more recent thing that happened.
  const inbound = describeSignInError(errorCode);
  const shownError = error ?? inbound?.message ?? null;
  // Nothing here can succeed while the server is misconfigured, so the form is
  // not offered as though it might.
  const disableSubmit = busy || inbound?.retryable === false;

  const startOAuth = async (provider: "google" | "github") => {
    setError(null);
    setPending("oauth");
    // No redirect: false here. The OAuth flow has to leave the page, and
    // Auth.js handles the round trip back to redirectTo itself.
    await signIn(provider, { redirectTo });
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending("credentials");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError(GENERIC_CREDENTIAL_ERROR);
        return;
      }

      // A full navigation rather than a router push: the session cookie was
      // just set, and every server component on the destination needs to be
      // rendered with it rather than served from the client cache.
      window.location.assign(redirectTo);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  };

  const submitLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending("link");

    try {
      const result = await signIn("nodemailer", {
        email,
        redirect: false,
        redirectTo,
      });

      if (result?.error) {
        setError("We could not send the sign-in link. Please try again.");
        return;
      }

      setLinkSent(true);
    } catch {
      setError("We could not send the sign-in link. Please try again.");
    } finally {
      setPending(null);
    }
  };

  if (linkSent) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-6 text-center">
        <MailIcon className="mx-auto mb-3 size-8 text-primary" aria-hidden="true" />
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          If an account exists for that address, a sign-in link is on its way. It
          expires in 15 minutes and can only be used once.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => {
            setLinkSent(false);
            setMode("password");
          }}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6">
      <h1 className="text-lg font-semibold">Sign in to Commit</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Welcome back. Choose how you would like to continue.
      </p>

      <div className="mt-5 space-y-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full justify-center"
          disabled={disableSubmit}
          onClick={() => startOAuth("google")}>
          <GoogleIcon className="size-4" aria-hidden="true" />
          Continue with Google
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full justify-center"
          disabled={disableSubmit}
          onClick={() => startOAuth("github")}>
          <GithubIcon className="size-4" aria-hidden="true" />
          Continue with GitHub
        </Button>
      </div>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={mode === "password" ? submitPassword : submitLink} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            disabled={busy}
          />
        </div>

        {mode === "password" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/reset-password"
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
                Forgot?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
            />
          </div>
        )}

        {shownError && (
          // role="alert" so it is announced. A sighted user sees it appear; a
          // screen-reader user otherwise gets no indication the submit failed.
          <p role="alert" className="text-sm text-destructive">
            {shownError}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full justify-center"
          disabled={disableSubmit}>
          {busy && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
          {mode === "password" ? "Sign in" : "Email me a sign-in link"}
        </Button>
      </form>

      <button
        type="button"
        className="mt-4 w-full text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        disabled={busy}
        onClick={() => {
          setMode(mode === "password" ? "link" : "password");
          setError(null);
        }}>
        {mode === "password"
          ? "Sign in with a link instead"
          : "Sign in with a password instead"}
      </button>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-primary underline underline-offset-4">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default SignInForm;
