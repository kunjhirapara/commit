import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { assertAdapterSecret } from "./lib/adapterAuth";
import { logAuditEvent, normalizeEmail } from "./lib/authz";

/**
 * The Convex half of the Auth.js adapter (src/lib/auth/convexAdapter.ts).
 *
 * These are ordinary mutations rather than internal functions, which means they
 * have a public endpoint, which means the secret check on the first line of
 * each one is load-bearing. See convex/lib/adapterAuth.ts for why that trade
 * was made; it was decided by experiment, not preference.
 *
 * Nothing outside the adapter should call these. User-facing reads go through
 * convex/users.ts as they always have.
 */

const secretArg = { secret: v.string() };

/**
 * Shape returned to Auth.js. Deliberately narrow: the adapter has no business
 * seeing roles, permission tags or onboarding state, and returning whole user
 * documents would eventually leak one of them into a session token.
 */
const toAdapterUser = (user: {
  _id: string;
  email: string;
  name: string;
  image?: string;
  emailVerified?: number;
}) => ({
  id: user._id,
  email: user.email,
  name: user.name,
  image: user.image ?? null,
  emailVerified: user.emailVerified ?? null,
});

export const createUser = mutation({
  args: {
    ...secretArg,
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    emailVerified: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertAdapterSecret(args.secret);

    const email = normalizeEmail(args.email);

    // Auth.js calls createUser without checking first, so a race between two
    // sign-ins with the same address would otherwise produce two rows.
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) return toAdapterUser(existing);

    const userId = await ctx.db.insert("users", {
      email,
      name: args.name,
      image: args.image,
      emailVerified: args.emailVerified,
      // Public sign-up produces candidates. Elevating anyone beyond that stays
      // an explicit, audited action, exactly as it was under Clerk.
      role: "candidate",
      // clerkId is still required by the schema and read in 137 places across
      // convex/. Rather than churn all of them mid-migration, a user created by
      // Auth.js becomes its own id here — which is what the field always meant
      // semantically, and what identity.subject now carries. It is dropped in
      // the final task of the migration.
      //
      // A Convex id does not exist until the row does, so this is written twice:
      // a placeholder that cannot collide, then the real id. The placeholder is
      // never observable — nothing can read the row before this mutation's
      // transaction commits.
      clerkId: `pending:${crypto.randomUUID()}`,
    });

    await ctx.db.patch(userId, { clerkId: userId, streamUserId: userId });

    await logAuditEvent(ctx, {
      action: "user.created",
      actorClerkId: userId,
      actorEmail: email,
      targetType: "user",
      targetId: userId,
      metadata: { via: "authjs" },
    });

    const created = await ctx.db.get(userId);

    return created ? toAdapterUser(created) : null;
  },
});

export const getUserById = query({
  args: { ...secretArg, id: v.string() },
  handler: async (ctx, args) => {
    assertAdapterSecret(args.secret);

    const user = await ctx.db.get(args.id as never);

    return user ? toAdapterUser(user as never) : null;
  },
});

export const getUserByEmail = query({
  args: { ...secretArg, email: v.string() },
  handler: async (ctx, args) => {
    assertAdapterSecret(args.secret);

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizeEmail(args.email)))
      .first();

    return user ? toAdapterUser(user) : null;
  },
});

export const getUserByAccount = query({
  args: { ...secretArg, provider: v.string(), providerAccountId: v.string() },
  handler: async (ctx, args) => {
    assertAdapterSecret(args.secret);

    const account = await ctx.db
      .query("authAccounts")
      .withIndex("by_provider_account", (q) =>
        q.eq("provider", args.provider).eq("providerAccountId", args.providerAccountId),
      )
      .first();

    if (!account) return null;

    const user = await ctx.db.get(account.userId);

    return user ? toAdapterUser(user) : null;
  },
});

export const updateUser = mutation({
  args: {
    ...secretArg,
    id: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerified: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertAdapterSecret(args.secret);

    const { secret: _secret, id, ...fields } = args;
    // Only the profile fields above are patchable. Notably absent: email and
    // role. Letting the adapter move an address would let an OAuth profile
    // change rewrite the identity every permission check hangs off.
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    );

    await ctx.db.patch(id as never, patch);

    const user = await ctx.db.get(id as never);

    return user ? toAdapterUser(user as never) : null;
  },
});

export const linkAccount = mutation({
  args: {
    ...secretArg,
    userId: v.string(),
    type: v.string(),
    provider: v.string(),
    providerAccountId: v.string(),
    refresh_token: v.optional(v.string()),
    access_token: v.optional(v.string()),
    expires_at: v.optional(v.number()),
    token_type: v.optional(v.string()),
    scope: v.optional(v.string()),
    id_token: v.optional(v.string()),
    session_state: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertAdapterSecret(args.secret);

    const { secret: _secret, userId, ...account } = args;

    // Re-linking the same provider identity must not create a second row, or
    // getUserByAccount starts depending on insertion order.
    const existing = await ctx.db
      .query("authAccounts")
      .withIndex("by_provider_account", (q) =>
        q.eq("provider", args.provider).eq("providerAccountId", args.providerAccountId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...account, userId: userId as never });

      return;
    }

    await ctx.db.insert("authAccounts", { ...account, userId: userId as never });

    await logAuditEvent(ctx, {
      action: "user.account_linked",
      actorClerkId: userId,
      targetType: "user",
      targetId: userId,
      metadata: { provider: args.provider },
    });
  },
});

export const unlinkAccount = mutation({
  args: { ...secretArg, provider: v.string(), providerAccountId: v.string() },
  handler: async (ctx, args) => {
    assertAdapterSecret(args.secret);

    const account = await ctx.db
      .query("authAccounts")
      .withIndex("by_provider_account", (q) =>
        q.eq("provider", args.provider).eq("providerAccountId", args.providerAccountId),
      )
      .first();

    if (account) await ctx.db.delete(account._id);
  },
});

export const createVerificationToken = mutation({
  args: {
    ...secretArg,
    identifier: v.string(),
    tokenHash: v.string(),
    expires: v.number(),
  },
  handler: async (ctx, args) => {
    assertAdapterSecret(args.secret);

    await ctx.db.insert("authVerificationTokens", {
      identifier: normalizeEmail(args.identifier),
      tokenHash: args.tokenHash,
      expires: args.expires,
    });
  },
});

export const useVerificationToken = mutation({
  args: { ...secretArg, identifier: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    assertAdapterSecret(args.secret);

    const identifier = normalizeEmail(args.identifier);
    const row = await ctx.db
      .query("authVerificationTokens")
      .withIndex("by_identifier_token", (q) =>
        q.eq("identifier", identifier).eq("tokenHash", args.tokenHash),
      )
      .first();

    if (!row) return null;

    // Deleted before the expiry check and before returning. Returning first and
    // deleting after leaves a window in which two concurrent requests both
    // redeem the same magic link, and an expired row should be cleaned up
    // whether or not it was usable.
    await ctx.db.delete(row._id);

    if (row.expires < Date.now()) return null;

    return { identifier: row.identifier, expires: row.expires };
  },
});

export const getCredentialByEmail = query({
  args: { ...secretArg, email: v.string() },
  handler: async (ctx, args) => {
    assertAdapterSecret(args.secret);

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizeEmail(args.email)))
      .first();

    if (!user) return null;

    const credential = await ctx.db
      .query("authCredentials")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!credential) return null;

    return { userId: user._id, passwordHash: credential.passwordHash };
  },
});

export const setCredential = mutation({
  args: { ...secretArg, userId: v.string(), passwordHash: v.string() },
  handler: async (ctx, args) => {
    assertAdapterSecret(args.secret);

    const existing = await ctx.db
      .query("authCredentials")
      .withIndex("by_user", (q) => q.eq("userId", args.userId as never))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        passwordHash: args.passwordHash,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("authCredentials", {
        userId: args.userId as never,
        passwordHash: args.passwordHash,
        updatedAt: Date.now(),
      });
    }

    await logAuditEvent(ctx, {
      action: "user.password_set",
      actorClerkId: args.userId,
      targetType: "user",
      targetId: args.userId,
    });
  },
});
