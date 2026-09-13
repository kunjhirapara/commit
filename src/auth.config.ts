import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

import { pickVerifiedGitHubEmail, type GitHubEmail } from "@/lib/auth/githubEmail";

/**
 * The half of the Auth.js configuration that must run on the Edge.
 *
 * `src/middleware.ts` imports this file and nothing else from the auth stack.
 * Middleware is bundled for the Edge runtime, which has no native modules and
 * no `node:` builtins, so everything reachable from here has to be portable.
 *
 * That rules out, specifically:
 *   - `src/lib/auth/password.ts`      — @node-rs/argon2 is a native module
 *   - `src/lib/auth/convexAdapter.ts` — hashes with node:crypto
 *   - the adapter, the Credentials `authorize` body, the email transport
 *
 * All of those live in `src/auth.ts`, which is Node-only. If the middleware
 * build starts failing with a message about a missing module, something
 * Node-only has been imported into this file or into something it pulls in —
 * that is the failure this split exists to produce loudly, at build time,
 * rather than at runtime on a user's first request.
 *
 * `@/lib/auth/githubEmail` is safe to import here: it is pure data handling with
 * no imports of its own.
 *
 * Credentials are deliberately absent rather than declared-but-empty. Auth.js
 * needs a provider's full definition only where sign-in is *performed*, and
 * middleware only ever *reads* an existing session.
 */

/**
 * WHY `allowDangerousEmailAccountLinking` IS SET, AND WHAT MAKES IT SAFE
 *
 * Without it, Auth.js refuses outright to attach an OAuth identity to an
 * existing account with the same email, and answers OAuthAccountNotLinked. That
 * is the correct default for an app with no opinion of its own — but it is
 * fatal here, because every account that predates this migration already exists
 * with an email address, so every one of those users would be permanently
 * locked out of Google and GitHub sign-in.
 *
 * The flag is named "dangerous" because Auth.js cannot tell whether the
 * provider verified the address. Turning it on alone would mean anyone able to
 * add a victim's address to their own Google or GitHub account inherits the
 * victim's Commit account and its role.
 *
 * What makes it safe is that we answer that question ourselves, before Auth.js
 * acts on it. The `signIn` callback in src/auth.ts applies
 * `mayLinkToExistingUser`, which refuses unless the provider positively asserts
 * the address is verified — and @auth/core runs `handleAuthorized` (the signIn
 * callback) before `handleLoginOrRegister` (the linking), so returning false
 * there is a prevention rather than a post-mortem.
 *
 * These two are therefore a pair. Removing the signIn callback, or weakening
 * mayLinkToExistingUser, silently turns this flag back into what its name says
 * it is. The GitHub userinfo override below exists for the same reason: the
 * stock provider discards the verified flag, and a guess in that argument
 * defeats the guard entirely.
 */

const GITHUB_API = "https://api.github.com";

export const authConfig = {
  // Client IDs and secrets are inferred from AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
  // and AUTH_GITHUB_ID / AUTH_GITHUB_SECRET, which is Auth.js's own convention
  // and already how .env.example names them. Passing them explicitly would be a
  // second place to keep in sync for no benefit.
  providers: [
    // Google is an OIDC provider, so `email_verified` arrives as a standard
    // claim and needs no help.
    Google({ allowDangerousEmailAccountLinking: true }),

    GitHub({
      allowDangerousEmailAccountLinking: true,

      userinfo: {
        url: `${GITHUB_API}/user`,

        /**
         * Replaces the stock request so that `email_verified` reaches the
         * sign-in callback truthfully. See src/lib/auth/githubEmail.ts for why
         * the default cannot be trusted for this.
         */
        async request({ tokens }: { tokens: { access_token?: string } }) {
          const headers = {
            Authorization: `Bearer ${tokens.access_token}`,
            "User-Agent": "commit-auth",
            Accept: "application/vnd.github+json",
          };

          const profile = (await fetch(`${GITHUB_API}/user`, { headers }).then((res) =>
            res.json(),
          )) as Record<string, unknown> & { email?: string | null };

          // Asked for unconditionally, unlike the stock provider, which skips
          // this whenever /user returned a public email. A public profile
          // address is not self-evidently verified, and this is the only
          // endpoint that says either way.
          try {
            const res = await fetch(`${GITHUB_API}/user/emails`, { headers });

            if (res.ok) {
              const picked = pickVerifiedGitHubEmail(
                (await res.json()) as GitHubEmail[],
                profile.email,
              );

              profile.email = picked.email || profile.email;
              profile.email_verified = picked.verified;
            } else {
              profile.email_verified = false;
            }
          } catch {
            // A network error here must not become "verified" by omission.
            profile.email_verified = false;
          }

          return profile;
        },
      },
    }),
  ],

  pages: {
    // Our own page, not the one Auth.js generates. `/signin` already exists and
    // is already in PUBLIC_ROUTES, so an unauthenticated visitor reaching it
    // does not bounce off the middleware into a redirect loop.
    signIn: "/signin",
    error: "/signin",
  },

  // Forced by the Credentials provider in src/auth.ts, which cannot be given a
  // database session. Declared here too so middleware reads sessions the same way.
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;

export default authConfig;
