import { createHash } from "node:crypto";

import type { Adapter, AdapterUser } from "@auth/core/adapters";

/**
 * The Auth.js adapter, over Convex.
 *
 * The backend call is injected rather than imported so this file can be tested
 * without a live deployment — the production wiring lives in src/auth.ts.
 *
 * Node runtime only: it hashes with node:crypto and must never be pulled into
 * the Edge middleware bundle. That is why src/auth.config.ts exists separately.
 */

/** Dispatches one named call to convex/authAdapter.ts. */
export type ConvexAdapterCall = (
  name: string,
  args: Record<string, unknown>,
) => Promise<unknown>;

/**
 * SHA-256, unsalted and fast — deliberately unlike password hashing.
 *
 * A magic-link token is 32+ bytes of randomness that Auth.js generated moments
 * ago, so there is no dictionary to attack and nothing a slow KDF would buy.
 * What the hash is for is that a leaked database snapshot must not contain
 * working sign-in links. Unsalted is required, not merely acceptable: lookup is
 * by hash, so the same token must always produce the same digest.
 */
export const hashVerificationToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const asUser = (value: unknown): AdapterUser | null =>
  value ? (value as AdapterUser) : null;

export const convexAdapter = (call: ConvexAdapterCall, secret: string): Adapter => ({
  createUser: async (user) => {
    const created = await call("createUser", {
      secret,
      email: user.email,
      // Auth.js permits a user with no name; the Convex schema does not, and an
      // email local-part is a better placeholder than an empty string in a UI.
      name: user.name ?? user.email.split("@")[0],
      image: user.image ?? undefined,
      emailVerified: user.emailVerified ? user.emailVerified.getTime() : undefined,
    });

    return asUser(created) as AdapterUser;
  },

  getUser: async (id) => asUser(await call("getUserById", { secret, id })),

  getUserByEmail: async (email) => asUser(await call("getUserByEmail", { secret, email })),

  getUserByAccount: async ({ provider, providerAccountId }) =>
    asUser(await call("getUserByAccount", { secret, provider, providerAccountId })),

  updateUser: async (user) => {
    const updated = await call("updateUser", {
      secret,
      id: user.id,
      name: user.name ?? undefined,
      image: user.image ?? undefined,
      emailVerified: user.emailVerified ? user.emailVerified.getTime() : undefined,
    });

    return asUser(updated) as AdapterUser;
  },

  linkAccount: async (account) => {
    await call("linkAccount", { secret, ...account });
  },

  unlinkAccount: async ({ provider, providerAccountId }) => {
    await call("unlinkAccount", { secret, provider, providerAccountId });
  },

  createVerificationToken: async (token) => {
    // Only the hash crosses this boundary. The plaintext exists solely inside
    // the email we are about to send.
    await call("createVerificationToken", {
      secret,
      identifier: token.identifier,
      tokenHash: hashVerificationToken(token.token),
      expires: token.expires.getTime(),
    });

    return token;
  },

  useVerificationToken: async ({ identifier, token }) => {
    const row = (await call("useVerificationToken", {
      secret,
      identifier,
      tokenHash: hashVerificationToken(token),
    })) as { identifier: string; expires: number } | null;

    if (!row) return null;

    // Auth.js expects the plaintext echoed back; it never left this process, so
    // returning it here is reconstruction rather than retrieval.
    return {
      identifier: row.identifier,
      token,
      expires: new Date(row.expires),
    };
  },

  // createSession, getSessionAndUser, updateSession and deleteSession are
  // deliberately absent. The Credentials provider forces session.strategy
  // "jwt", under which Auth.js never calls them. Stubs that returned something
  // plausible would hide a misconfiguration; missing methods surface it.
});
