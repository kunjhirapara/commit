import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";
import { fetchMutation, fetchQuery } from "convex/nextjs";

import { api } from "../convex/_generated/api";
import { authConfig } from "./auth.config";
import { convexAdapter, type ConvexAdapterCall } from "@/lib/auth/convexAdapter";
import { mayLinkToExistingUser } from "@/lib/auth/linking";
import { equalizePasswordTiming, verifyPassword } from "@/lib/auth/password";
import { sendEmail } from "@/lib/email";
import { signInLinkTemplate } from "@/lib/email/templates";

/**
 * The Node-only half of the Auth.js configuration.
 *
 * Everything here is unavailable to the Edge: argon2 is a native module, the
 * adapter hashes with node:crypto, and the mail transport opens a socket. The
 * Edge-safe half is `src/auth.config.ts`, which is what middleware imports.
 *
 * See docs/superpowers/plans/2026-09-12-custom-auth.md, Phase 2.
 */

/** Magic links are credentials in an inbox. Auth.js defaults to 24h; this does not. */
const SIGN_IN_LINK_MAX_AGE_SECONDS = 15 * 60;

/**
 * The shared secret in front of convex/authAdapter.ts.
 *
 * Read per request rather than once at module load, and that is not a style
 * choice. `next build` runs with NODE_ENV=production and without runtime
 * secrets — the Docker build passes only the NEXT_PUBLIC_* build args — so a
 * module-scope throw would fail the image build rather than a sign-in, and the
 * error would point at auth from a step that has nothing to do with it.
 *
 * Throwing here instead means the failure lands on the request that actually
 * needed the secret, where the message can say what to set. Every adapter call
 * would otherwise fail closed with a bare "Unauthorized" from the Convex side,
 * which is correct but surfaces as "sign-in is broken for everyone" with no
 * indication that one environment variable is the cause.
 */
const requireAdapterSecret = (): string => {
  const secret = process.env.AUTH_ADAPTER_SECRET?.trim();

  if (secret) return secret;

  throw new Error(
    "AUTH_ADAPTER_SECRET is not set. Auth.js cannot reach convex/authAdapter.ts " +
      "without it, so every sign-in fails. Set it in the Next environment and to " +
      "the same value in Convex (`npx convex env set AUTH_ADAPTER_SECRET ...`).",
  );
};

// Split by kind because Convex distinguishes queries from mutations at the
// transport level; the adapter in src/lib/auth/convexAdapter.ts only knows
// call names.
const ADAPTER_QUERIES = {
  getUserById: api.authAdapter.getUserById,
  getUserByEmail: api.authAdapter.getUserByEmail,
  getUserByAccount: api.authAdapter.getUserByAccount,
} as const;

const ADAPTER_MUTATIONS = {
  createUser: api.authAdapter.createUser,
  updateUser: api.authAdapter.updateUser,
  linkAccount: api.authAdapter.linkAccount,
  unlinkAccount: api.authAdapter.unlinkAccount,
  createVerificationToken: api.authAdapter.createVerificationToken,
  useVerificationToken: api.authAdapter.useVerificationToken,
} as const;

const callConvex: ConvexAdapterCall = async (name, args) => {
  // The secret is injected here, not baked into the adapter at construction,
  // so that it is read at request time. See requireAdapterSecret above for why
  // that matters to the image build. This overrides whatever the adapter put in
  // `args.secret`, which is the placeholder passed to convexAdapter below.
  const withSecret = { ...args, secret: requireAdapterSecret() };

  const query = ADAPTER_QUERIES[name as keyof typeof ADAPTER_QUERIES];
  if (query) return fetchQuery(query, withSecret as never);

  const mutation = ADAPTER_MUTATIONS[name as keyof typeof ADAPTER_MUTATIONS];
  if (mutation) return fetchMutation(mutation, withSecret as never);

  // A name that exists in the adapter but in neither map above would otherwise
  // reach Convex as a generic 404 that names no call.
  throw new Error(`Unknown Convex adapter call: ${name}`);
};

/**
 * Records an auth event, and never lets doing so break a sign-in.
 *
 * Observability is worth having and is not worth failing closed over: if Convex
 * is unreachable, the right outcome is an unlogged sign-in, not a user who
 * cannot get in.
 *
 * Never pass the submitted address. `recordAuthEvent` takes no email argument
 * for that reason — a rejection log that records what was tried is the
 * user-enumeration oracle the generic error message exists to prevent, moved
 * somewhere it is easier to read in bulk.
 */
const recordAuthEvent = async (event: {
  scope: string;
  level: "info" | "warn" | "error" | "critical";
  message: string;
  status?: string;
}): Promise<void> => {
  try {
    await fetchMutation(api.authAdapter.recordAuthEvent, {
      secret: requireAdapterSecret(),
      ...event,
    });
  } catch (error) {
    console.error("[auth] could not record auth event", error);
  }
};

const REJECTED = {
  level: "warn",
  message: "Sign-in rejected.",
  status: "rejected",
} as const;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  // The secret argument is a placeholder: callConvex overwrites args.secret on
  // every call with the value read at request time. Passing a real one here
  // would mean reading the environment at module load, which the image build
  // does not have.
  adapter: convexAdapter(callConvex, "injected-per-call"),

  // Forced by Credentials, which Auth.js cannot give a database session to. The
  // adapter is still used for users, accounts and verification tokens.
  session: { strategy: "jwt" },

  providers: [
    ...authConfig.providers,

    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      /**
       * Returns null for every failure, and spends the same time doing it.
       *
       * The branches below deliberately do not distinguish "no such account"
       * from "wrong password" in what they return, in what they log, or in how
       * long they take. The first two are easy and usually done; the third is
       * the one that gets missed, which is what `equalizePasswordTiming` is for.
       */
      authorize: async (raw) => {
        const email =
          typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : "";
        const password = typeof raw?.password === "string" ? raw.password : "";

        if (!email || !password) {
          await equalizePasswordTiming(password);
          await recordAuthEvent({
            scope: "authjs.credentials.incomplete",
            ...REJECTED,
          });
          return null;
        }

        const credential = await fetchQuery(api.authAdapter.getCredentialByEmail, {
          secret: requireAdapterSecret(),
          email,
        });

        if (!credential) {
          await equalizePasswordTiming(password);
          await recordAuthEvent({
            scope: "authjs.credentials.unknown",
            ...REJECTED,
          });
          return null;
        }

        if (!(await verifyPassword(password, credential.passwordHash))) {
          await recordAuthEvent({
            scope: "authjs.credentials.mismatch",
            ...REJECTED,
          });
          return null;
        }

        const user = await fetchQuery(api.authAdapter.getUserById, {
          secret: requireAdapterSecret(),
          id: credential.userId,
        });

        if (!user) {
          // A credential row whose user is gone. Not the caller's fault and not
          // something they can fix, but it must not sign anyone in.
          await recordAuthEvent({
            scope: "authjs.credentials.orphaned",
            level: "error",
            message: "Credential row has no user.",
            status: "rejected",
          });
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),

    Nodemailer({
      from: process.env.SMTP_FROM_EMAIL,
      maxAge: SIGN_IN_LINK_MAX_AGE_SECONDS,

      /**
       * Never used, and required anyway.
       *
       * The provider constructor throws "Nodemailer requires a `server`
       * configuration" unless this is truthy, but it is only ever read by the
       * *default* `sendVerificationRequest`, which is replaced below. Sending
       * goes through src/lib/email/transport.ts so that magic links obey the
       * same SMTP settings, pooling and misconfiguration handling as every other
       * email.
       *
       * Deliberately not the real SMTP values: duplicating them here would make
       * a second source of truth that nothing reads, and the first time they
       * disagreed the dead copy would be the one someone trusted.
       */
      server: { host: "unused.invalid", port: 25, auth: { user: "", pass: "" } },

      /**
       * Sends through the app's own transport rather than Auth.js's, so magic
       * links obey the same SMTP configuration, branding and misconfiguration
       * handling as every other email this app sends.
       *
       * Throws when the send fails. Returning quietly would render "check your
       * inbox" for mail that was never sent, which is the worst version of this
       * failure: the user waits, retries, and nothing in the UI ever admits it
       * did not happen.
       */
      sendVerificationRequest: async ({ identifier, url }) => {
        const template = signInLinkTemplate({
          url,
          expiresInMinutes: Math.round(SIGN_IN_LINK_MAX_AGE_SECONDS / 60),
        });

        const result = await sendEmail({
          to: identifier,
          subject: template.subject,
          html: template.html,
        });

        if (!result.success) {
          await recordAuthEvent({
            scope: "authjs.email.send",
            level: "error",
            message: "Sign-in link could not be sent.",
            status: "failed",
          });

          throw new Error(result.error ?? "Could not send the sign-in link.");
        }
      },
    }),
  ],

  callbacks: {
    /**
     * The account-takeover guard.
     *
     * Runs before Auth.js links anything: `handleAuthorized` is called ahead of
     * `handleLoginOrRegister` in the @auth/core callback route, which is what
     * makes returning false here a prevention rather than a post-mortem.
     *
     * THIS FUNCTION IS LOAD-BEARING. Both providers in src/auth.config.ts set
     * `allowDangerousEmailAccountLinking: true`, which switches off Auth.js's
     * own refusal to attach an OAuth identity to an existing account. That flag
     * is only safe because this callback answers the question Auth.js cannot:
     * whether the provider actually verified the address. Delete or weaken this
     * and the flag becomes exactly what its name says.
     *
     * The rule itself lives in src/lib/auth/linking.ts with its own tests. This
     * function's only job is to feed it honest inputs — which is also why
     * src/auth.config.ts overrides the GitHub userinfo request. The stock
     * provider discards the verified flag, and a guess in that argument defeats
     * the whole check.
     */
    signIn: async ({ user, account, profile }) => {
      if (!account || (account.type !== "oauth" && account.type !== "oidc")) {
        return true;
      }

      const providerEmail =
        (typeof profile?.email === "string" ? profile.email : null) ??
        user?.email ??
        null;

      if (!providerEmail) {
        await recordAuthEvent({ scope: "authjs.oauth.no_email", ...REJECTED });
        return false;
      }

      // Already linked means this is a returning user rather than a new
      // attachment, and the linking rule has nothing to say about it.
      const linked = await fetchQuery(api.authAdapter.getUserByAccount, {
        secret: requireAdapterSecret(),
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      });

      if (linked) return true;

      const existing = await fetchQuery(api.authAdapter.getUserByEmail, {
        secret: requireAdapterSecret(),
        email: providerEmail,
      });

      // No account with this address: nothing to take over, and the adapter
      // will create a fresh user.
      if (!existing) return true;

      const allowed = mayLinkToExistingUser({
        providerEmail,
        // Strictly === true. An absent claim is not a verified address, and
        // Boolean(undefined) would be the same bug written less visibly.
        providerEmailVerified:
          (profile as { email_verified?: unknown } | null)?.email_verified === true,
        existingUserEmail: existing.email,
      });

      if (!allowed) {
        await recordAuthEvent({
          scope: "authjs.oauth.link_refused",
          level: "warn",
          message: "Refused to link an OAuth identity to an existing account.",
          status: "rejected",
        });
        return false;
      }

      return true;
    },

    /**
     * `sub` carries the Convex user id, because that is what the token route
     * signs into the Convex JWT and what convex/users.ts resolves identities
     * against. Auth.js sets it from `user.id` on first sign-in; it is written
     * explicitly so a change to that default cannot quietly break the link
     * between a session and its Convex document.
     */
    jwt: async ({ token, user }) => {
      if (user?.id) token.sub = user.id;
      return token;
    },

    session: async ({ session, token }) => {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },

  events: {
    signIn: async ({ isNewUser }) => {
      await recordAuthEvent({
        scope: isNewUser ? "authjs.signup" : "authjs.signin",
        level: "info",
        message: isNewUser ? "Account created." : "Signed in.",
        status: "succeeded",
      });
    },
  },
});
