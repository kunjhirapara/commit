"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GithubIcon, GoogleIcon } from "@/components/auth/ProviderIcons";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/passwordPolicy";

/**
 * The sign-up form.
 *
 * Registration and sign-in are two requests, not one: /api/auth/register writes
 * the credential, then this signs in with it normally. That split is what lets
 * the register route answer identically whether or not the address was already
 * taken — see its header comment for why it must.
 *
 * The consequence to understand here is that a failed sign-in after a
 * successful register is an expected path, not a bug: it is what someone sees
 * when the address already has an account and they did not guess its password.
 * The message says so as helpfully as it can without confirming anything.
 */

const ALREADY_REGISTERED_HINT =
  "We could not sign you in. If you already have an account with this address, try signing in or resetting your password.";

export function SignUpForm({ redirectTo }: { redirectTo: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Mirrors the server, which enforces the same floor in hashPassword. Shown
  // here so the requirement is visible before submitting rather than after.
  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  const startOAuth = async (provider: "google" | "github") => {
    setError(null);
    setPending(true);
    await signIn(provider, { redirectTo });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "We could not create your account.");
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError(ALREADY_REGISTERED_HINT);
        return;
      }

      // Full navigation so server components render with the new cookie.
      window.location.assign(redirectTo);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6">
      <h1 className="text-lg font-semibold">Create your Commit account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Run a technical interview in one room, with the editor and the runner.
      </p>

      <div className="mt-5 space-y-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full justify-center"
          disabled={pending}
          onClick={() => startOAuth("google")}>
          <GoogleIcon className="size-4" aria-hidden="true" />
          Continue with Google
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full justify-center"
          disabled={pending}
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

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            disabled={pending}
          />
        </div>

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
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending}
            aria-describedby="password-requirement"
          />
          <p
            id="password-requirement"
            className={`text-xs ${passwordTooShort ? "text-destructive" : "text-muted-foreground"}`}>
            {/* Length rather than composition rules: a long passphrase is both
                stronger and easier to remember than a short string with a
                symbol bolted on. Same reasoning as MIN_PASSWORD_LENGTH. */}
            At least {MIN_PASSWORD_LENGTH} characters. A passphrase works well.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full justify-center" disabled={pending}>
          {pending && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
          Create account
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/signin" className="text-primary underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default SignUpForm;
