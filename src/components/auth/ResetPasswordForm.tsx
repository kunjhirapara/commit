"use client";

import { useState } from "react";
import Link from "next/link";
import { LoaderCircleIcon, MailIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/passwordPolicy";

/**
 * Both halves of the reset flow, chosen by whether a token is in the URL.
 *
 * They are one component because they are one user journey and share all of
 * their chrome; splitting them would mean two files that differ by a heading
 * and a field.
 *
 * This is also the only route by which an account that has only ever used
 * Google or GitHub can gain a password. /api/auth/register refuses to write a
 * credential for an address that already exists — that would be takeover — so
 * "forgot password" doubles as "set a password", and the copy avoids promising
 * the user had one before.
 */

export function ResetPasswordForm({
  token,
  emailFromLink,
}: {
  token: string | null;
  emailFromLink: string | null;
}) {
  const hasToken = Boolean(token && emailFromLink);

  const [email, setEmail] = useState(emailFromLink ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [requested, setRequested] = useState(false);
  const [done, setDone] = useState(false);

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/auth/reset/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.status === 429) {
        setError("Too many attempts. Please wait a minute and try again.");
        return;
      }

      // Anything else is the deliberate generic success. The route answers the
      // same whether or not the address has an account, so there is nothing
      // here to branch on.
      setRequested(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const submitNewPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/auth/reset/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: emailFromLink, token, password }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? "We could not reset your password.");
        return;
      }

      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Password updated</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You can now sign in with your new password.
        </p>
        <Button asChild size="lg" className="mt-5 w-full justify-center">
          <Link href="/signin">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  if (requested) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-6 text-center">
        <MailIcon className="mx-auto mb-3 size-8 text-primary" aria-hidden="true" />
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          If an account exists for that address, a reset link is on its way. It
          expires in 30 minutes and can only be used once.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Your current password keeps working until you use the link.
        </p>
        <Button variant="ghost" size="sm" className="mt-4" asChild>
          <Link href="/signin">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  if (hasToken) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-6">
        <h1 className="text-lg font-semibold">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          For {emailFromLink}.
        </p>

        <form onSubmit={submitNewPassword} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={pending}
              aria-describedby="new-password-requirement"
            />
            <p
              id="new-password-requirement"
              className={`text-xs ${passwordTooShort ? "text-destructive" : "text-muted-foreground"}`}>
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
            Update password
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6">
      <h1 className="text-lg font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We will email you a link to set a new one.
      </p>

      <form onSubmit={submitRequest} className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reset-email">Email address</Label>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            disabled={pending}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full justify-center" disabled={pending}>
          {pending && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
          Email me a reset link
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        <Link href="/signin" className="text-primary underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default ResetPasswordForm;
