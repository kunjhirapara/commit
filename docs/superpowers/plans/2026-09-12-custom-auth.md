# Clerk to Auth.js Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Clerk with Auth.js v5 as the identity provider, keeping every existing user, their roles, their interviews and their Stream.io recording history.

**Architecture:** Auth.js owns authentication in Next.js (session in a cookie, JWT strategy). Convex stays the source of truth for users and authorization. They meet at exactly one seam: a Next route mints a short-lived RS256 JWT that Convex verifies against a JWKS we publish, using Convex's `customJwt` provider.

**Tech Stack:** Next.js 16, React 18, Convex 1.35, `next-auth@5`, `jose` (JWT), `@node-rs/argon2` (hashing), existing `nodemailer` stack in `src/lib/email`.

**Spec:** `docs/superpowers/specs/2026-09-12-custom-auth-design.md`

## Global Constraints

- Session strategy is **`jwt`**. The Credentials provider does not support database sessions. Never set `strategy: "database"`.
- Convex token expiry is **10 minutes**. Longer tokens outlive sign-out.
- Convex provider type is **`customJwt`** with `applicationID: "convex"`, `algorithm: "RS256"`. Not OIDC.
- Every JWT carries a **`kid`** header from the first commit.
- Password hashing is **argon2id**, Node runtime only. Never import it into anything the Edge middleware loads.
- OAuth account linking to an existing email happens **only when the provider reports the email verified**. Fail closed.
- Auth failures return **one generic message**. Never distinguish "no such user" from "wrong password".
- Convex schema changes are **additive first**. Convex validates the schema against existing rows, so a rename or a new required field fails until every row is backfilled.
- Tests use `node:test` + `node:assert/strict`, live in `src/lib/**`, and import with an explicit `.ts` extension. Run with `npm test`.
- Every task ends green: `npm run typecheck && npm test`.

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `src/lib/auth/convexToken.ts` | Mint and verify the Convex JWT. Pure, testable. |
| `src/lib/auth/convexToken.test.ts` | Round-trip, expiry, `kid`, wrong-key rejection. |
| `src/lib/auth/password.ts` | argon2id hash and verify. |
| `src/lib/auth/password.test.ts` | Hash/verify, wrong password rejection. |
| `src/lib/auth/convexAdapter.ts` | Auth.js `Adapter` implemented over Convex. |
| `src/lib/auth/convexAdapter.test.ts` | Adapter method behaviour. |
| `src/lib/auth/linking.ts` | The verified-email linking rule, isolated so it is testable. |
| `src/lib/auth/linking.test.ts` | Refuses unverified emails. |
| `src/auth.config.ts` | Edge-safe Auth.js config: providers only. |
| `src/auth.ts` | Full Auth.js instance: adapter, callbacks, Node-only bits. |
| `src/app/api/auth/[...nextauth]/route.ts` | Auth.js route handlers. |
| `src/app/api/auth/convex-token/route.ts` | The seam. Mints the Convex JWT. |
| `src/app/.well-known/jwks.json/route.ts` | Publishes the public key. |
| `src/components/providers/ConvexAuthProvider.tsx` | Replaces `ConvexClerkProvider`. |
| `src/components/auth/SessionGuards.tsx` | Local `SignedIn` / `SignedOut`. |
| `src/components/auth/UserMenu.tsx` | Replaces Clerk `UserButton`. |
| `src/hooks/useCurrentUser.ts` | Replaces `useUser`. |
| `convex/authAdapter.ts` | Convex functions backing the adapter. |
| `convex/migrations/authBackfill.ts` | Idempotent backfill. |

**Modified:** `convex/schema.ts`, `convex/auth.config.ts`, `convex/lib/errorUtils.ts`, `convex/users.ts`, `convex/http.ts`, `src/middleware.ts`, `src/actions/stream.actions.ts`, `src/app/api/execute/route.ts`, `src/app/api/invitations/route.ts`, `src/app/api/telemetry/route.ts`, `src/app/signin/page.tsx`, `src/app/signup/page.tsx`, `src/components/ui/Navbar.tsx`, `src/components/marketing/LandingPage.tsx`, `src/hooks/useUserRole.ts`, `src/hooks/useSyncUser.ts`, `src/hooks/useGetCalls.ts`, `.env.example`.

**Deleted (last task only):** `src/lib/clerkAppearance.ts`, `src/components/providers/ConvexClerkProvider.tsx`.

---

## Phase 1 — Foundation

Nothing in this phase removes Clerk. The app keeps working throughout.

### Task 1: Additive Convex schema

**Files:**
- Modify: `convex/schema.ts`

**Interfaces:**
- Produces: tables `authAccounts`, `authVerificationTokens`, `authCredentials`; `users.legacyClerkId`, `users.streamUserId`, `users.emailVerified`.

`clerkId` stays **required** in this task. Convex rejects a schema that existing rows do not satisfy, so the rename only happens after the backfill in Task 12.

- [ ] **Step 1: Add the three auth tables**

```ts
  authAccounts: defineTable({
    userId: v.id("users"),
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
  })
    .index("by_provider_account", ["provider", "providerAccountId"])
    .index("by_user", ["userId"]),

  // Only a hash is stored. A leaked database must not yield working magic links.
  authVerificationTokens: defineTable({
    identifier: v.string(),
    tokenHash: v.string(),
    expires: v.number(),
  }).index("by_identifier_token", ["identifier", "tokenHash"]),

  // Separate from `users` so no existing user query can ever return a hash.
  authCredentials: defineTable({
    userId: v.id("users"),
    passwordHash: v.string(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
```

- [ ] **Step 2: Add the three optional user fields**

In the existing `users: defineTable({...})`, add alongside `clerkId`:

```ts
    // Populated by the Auth.js backfill. Optional because Convex validates the
    // schema against existing rows, which do not have it yet.
    legacyClerkId: v.optional(v.string()),
    // Stream.io identity. Carried from clerkId for migrated users so their
    // recording history survives; the Convex user id for new users.
    streamUserId: v.optional(v.string()),
    emailVerified: v.optional(v.number()),
```

And add the index next to `by_clerk_id`:

```ts
    .index("by_legacy_clerk_id", ["legacyClerkId"])
```

- [ ] **Step 3: Push and verify the schema is accepted**

Run: `npx convex dev --once`
Expected: schema pushes with no validation error. If it reports documents failing validation, a field was made required — make it optional.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(auth): additive schema for Auth.js tables and user fields"
```

---

### Task 2: Convex JWT mint and verify

**Files:**
- Create: `src/lib/auth/convexToken.ts`, `src/lib/auth/convexToken.test.ts`

**Interfaces:**
- Produces:
  - `mintConvexToken(opts: { userId: string; privateKeyPem: string; kid: string; issuer: string; now?: number }): Promise<string>`
  - `verifyConvexToken(token: string, publicKeyPem: string, issuer: string): Promise<{ sub: string }>`
  - `publicJwkFromPem(publicKeyPem: string, kid: string): Promise<JsonWebKey>`
  - Constant `CONVEX_TOKEN_TTL_SECONDS = 600`

- [ ] **Step 1: Install jose**

```bash
npm install jose
```

- [ ] **Step 2: Write the failing test**

`src/lib/auth/convexToken.test.ts`:

```ts
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";

import {
  CONVEX_TOKEN_TTL_SECONDS,
  mintConvexToken,
  publicJwkFromPem,
  verifyConvexToken,
} from "./convexToken.ts";

const keypair = () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  return { privateKey, publicKey };
};

const ISSUER = "https://commit.kunjdeveloper.com";

/**
 * This token is the only thing standing between a browser session and every
 * Convex function. A token signed by the wrong key, aimed at the wrong issuer,
 * or accepted after expiry is a full authorization bypass, so each of those is
 * asserted rather than assumed.
 */
describe("convex token", () => {
  it("round-trips the user id", async () => {
    const { privateKey, publicKey } = keypair();

    const token = await mintConvexToken({
      userId: "user_123",
      privateKeyPem: privateKey,
      kid: "k1",
      issuer: ISSUER,
    });
    const claims = await verifyConvexToken(token, publicKey, ISSUER);

    assert.equal(claims.sub, "user_123");
  });

  it("rejects a token signed by a different key", async () => {
    const signer = keypair();
    const attacker = keypair();

    const token = await mintConvexToken({
      userId: "user_123",
      privateKeyPem: attacker.privateKey,
      kid: "k1",
      issuer: ISSUER,
    });

    await assert.rejects(() => verifyConvexToken(token, signer.publicKey, ISSUER));
  });

  it("rejects a token minted for a different issuer", async () => {
    const { privateKey, publicKey } = keypair();

    const token = await mintConvexToken({
      userId: "user_123",
      privateKeyPem: privateKey,
      kid: "k1",
      issuer: "https://evil.example.com",
    });

    await assert.rejects(() => verifyConvexToken(token, publicKey, ISSUER));
  });

  it("rejects a token that has expired", async () => {
    const { privateKey, publicKey } = keypair();
    const longAgo = Math.floor(Date.now() / 1000) - CONVEX_TOKEN_TTL_SECONDS - 60;

    const token = await mintConvexToken({
      userId: "user_123",
      privateKeyPem: privateKey,
      kid: "k1",
      issuer: ISSUER,
      now: longAgo,
    });

    await assert.rejects(() => verifyConvexToken(token, publicKey, ISSUER));
  });

  it("publishes a JWK carrying the same kid the token is signed with", async () => {
    const { publicKey } = keypair();

    const jwk = await publicJwkFromPem(publicKey, "k1");

    assert.equal(jwk.kid, "k1");
    assert.equal(jwk.alg, "RS256");
    assert.equal(jwk.use, "sig");
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npm test`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./convexToken.ts`.

- [ ] **Step 4: Implement**

`src/lib/auth/convexToken.ts`:

```ts
import { SignJWT, exportJWK, importPKCS8, importSPKI, jwtVerify } from "jose";

/**
 * Ten minutes. Signing out only clears the Auth.js cookie, so an already-minted
 * Convex token stays valid until it expires — the TTL is the revocation window.
 */
export const CONVEX_TOKEN_TTL_SECONDS = 600;

/** Must match `applicationID` in convex/auth.config.ts. */
const AUDIENCE = "convex";
const ALG = "RS256";

export const mintConvexToken = async ({
  userId,
  privateKeyPem,
  kid,
  issuer,
  now = Math.floor(Date.now() / 1000),
}: {
  userId: string;
  privateKeyPem: string;
  kid: string;
  issuer: string;
  now?: number;
}): Promise<string> => {
  const key = await importPKCS8(privateKeyPem, ALG);

  return new SignJWT({})
    .setProtectedHeader({ alg: ALG, kid })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + CONVEX_TOKEN_TTL_SECONDS)
    .sign(key);
};

export const verifyConvexToken = async (
  token: string,
  publicKeyPem: string,
  issuer: string,
): Promise<{ sub: string }> => {
  const key = await importSPKI(publicKeyPem, ALG);
  const { payload } = await jwtVerify(token, key, {
    issuer,
    audience: AUDIENCE,
    algorithms: [ALG],
  });

  if (!payload.sub) throw new Error("Convex token has no subject");

  return { sub: payload.sub };
};

export const publicJwkFromPem = async (publicKeyPem: string, kid: string) => {
  const key = await importSPKI(publicKeyPem, ALG);
  const jwk = await exportJWK(key);

  return { ...jwk, kid, alg: ALG, use: "sig" };
};
```

- [ ] **Step 5: Run and confirm green**

Run: `npm test`
Expected: all 5 new cases PASS, existing suite still passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/convexToken.ts src/lib/auth/convexToken.test.ts package.json package-lock.json
git commit -m "feat(auth): mint and verify the Convex JWT"
```

---

### Task 3: JWKS endpoint and Convex provider config

**Files:**
- Create: `src/app/.well-known/jwks.json/route.ts`
- Modify: `convex/auth.config.ts`, `.env.example`

**Interfaces:**
- Consumes: `publicJwkFromPem` from Task 2.
- Produces: a public `GET /.well-known/jwks.json`; Convex configured to trust it.

- [ ] **Step 1: Generate a keypair for local development**

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out /tmp/auth_private.pem
openssl rsa -pubout -in /tmp/auth_private.pem -out /tmp/auth_public.pem
```

Put both into `.env.local` as single-line values with `\n` escapes:

```
AUTH_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
AUTH_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
AUTH_JWT_KID="k1"
```

- [ ] **Step 2: Add the JWKS route**

`src/app/.well-known/jwks.json/route.ts`:

```ts
import { NextResponse } from "next/server";

import { publicJwkFromPem } from "@/lib/auth/convexToken";

// Node runtime: jose's PEM import is not available on Edge.
export const runtime = "nodejs";

export async function GET() {
  const pem = process.env.AUTH_JWT_PUBLIC_KEY?.replace(/\\n/g, "\n");
  const kid = process.env.AUTH_JWT_KID;

  if (!pem || !kid) {
    return NextResponse.json({ error: "JWKS not configured" }, { status: 503 });
  }

  const jwk = await publicJwkFromPem(pem, kid);

  return NextResponse.json(
    { keys: [jwk] },
    // Convex caches this. An hour keeps rotation quick without hammering us.
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
```

- [ ] **Step 3: Make the route public in middleware**

In `src/lib/routeAccess.ts`, add to `PUBLIC_ROUTES`:

```ts
  // Convex fetches this unauthenticated to verify our tokens. If it 307s to
  // /signin, every Convex call fails with an auth error that looks like a bug
  // in authorization rather than a blocked well-known route.
  /^\/\.well-known\/jwks\.json$/,
```

- [ ] **Step 4: Point Convex at it**

Replace `convex/auth.config.ts` entirely:

```ts
const siteUrl = process.env.SITE_URL;

if (!siteUrl) {
  throw new Error(
    "Missing SITE_URL in Convex environment. Set it with `npx convex env set SITE_URL https://commit.kunjdeveloper.com`.",
  );
}

export default {
  providers: [
    {
      type: "customJwt",
      applicationID: "convex",
      issuer: siteUrl,
      jwks: `${siteUrl}/.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
};
```

Set it: `npx convex env set SITE_URL http://localhost:3000`

- [ ] **Step 5: Verify the endpoint serves a key**

Run: `npm run dev` then `curl -s localhost:3000/.well-known/jwks.json`
Expected: `{"keys":[{"kty":"RSA",...,"kid":"k1","alg":"RS256","use":"sig"}]}`

- [ ] **Step 6: Document the new env vars**

Add to `.env.example` under a new `Auth.js` section: `AUTH_JWT_PRIVATE_KEY`, `AUTH_JWT_PUBLIC_KEY`, `AUTH_JWT_KID`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, and note `SITE_URL` goes on the Convex deployment.

- [ ] **Step 7: Commit**

```bash
git add src/app/.well-known convex/auth.config.ts src/lib/routeAccess.ts .env.example
git commit -m "feat(auth): publish JWKS and point Convex at our issuer"
```

---

### Task 4: Password hashing

**Files:**
- Create: `src/lib/auth/password.ts`, `src/lib/auth/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>`, `MIN_PASSWORD_LENGTH = 12`

- [ ] **Step 1: Install argon2**

```bash
npm install @node-rs/argon2
```

- [ ] **Step 2: Write the failing test**

`src/lib/auth/password.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "./password.ts";

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    assert.equal(await verifyPassword("wrong horse battery staple", hash), false);
  });

  it("produces a different hash each time for the same input", async () => {
    const a = await hashPassword("correct horse battery staple");
    const b = await hashPassword("correct horse battery staple");

    assert.notEqual(a, b);
  });

  it("refuses to hash a password below the minimum length", async () => {
    await assert.rejects(() => hashPassword("a".repeat(MIN_PASSWORD_LENGTH - 1)));
  });

  it("returns false rather than throwing on a malformed hash", async () => {
    assert.equal(await verifyPassword("anything", "not-a-hash"), false);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npm test`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./password.ts`.

- [ ] **Step 4: Implement**

`src/lib/auth/password.ts`:

```ts
import { hash, verify } from "@node-rs/argon2";

/**
 * argon2id, Node runtime only. Never import this from anything the Edge
 * middleware loads — see the auth.config.ts / auth.ts split.
 */

export const MIN_PASSWORD_LENGTH = 12;

export const hashPassword = async (plain: string): Promise<string> => {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  return hash(plain);
};

/**
 * Returns false rather than throwing on a malformed stored hash. A throw here
 * would surface as a 500 and tell an attacker the account exists.
 */
export const verifyPassword = async (plain: string, stored: string): Promise<boolean> => {
  try {
    return await verify(stored, plain);
  } catch {
    return false;
  }
};
```

- [ ] **Step 5: Run and confirm green**

Run: `npm test`
Expected: 5 new cases PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/password.ts src/lib/auth/password.test.ts package.json package-lock.json
git commit -m "feat(auth): argon2id password hashing"
```

---

### Task 5: The account-linking rule

**Files:**
- Create: `src/lib/auth/linking.ts`, `src/lib/auth/linking.test.ts`

**Interfaces:**
- Produces: `mayLinkToExistingUser(input: { providerEmail: string | null | undefined; providerEmailVerified: boolean; existingUserEmail: string }): boolean`

Isolated into its own module precisely because it is the highest-risk rule in the design — it deserves a test file of its own rather than being buried in a callback.

- [ ] **Step 1: Write the failing test**

`src/lib/auth/linking.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mayLinkToExistingUser } from "./linking.ts";

/**
 * Account takeover lives here. If an OAuth provider hands us an email it has
 * not verified, anyone who can sign up at that provider with a victim's address
 * inherits the victim's Commit account, including their role. Every case below
 * must fail closed.
 */
describe("mayLinkToExistingUser", () => {
  it("links when the provider verified a matching email", () => {
    assert.equal(
      mayLinkToExistingUser({
        providerEmail: "user@example.com",
        providerEmailVerified: true,
        existingUserEmail: "user@example.com",
      }),
      true,
    );
  });

  it("refuses when the provider has not verified the email", () => {
    assert.equal(
      mayLinkToExistingUser({
        providerEmail: "user@example.com",
        providerEmailVerified: false,
        existingUserEmail: "user@example.com",
      }),
      false,
    );
  });

  it("refuses when the emails differ", () => {
    assert.equal(
      mayLinkToExistingUser({
        providerEmail: "attacker@example.com",
        providerEmailVerified: true,
        existingUserEmail: "user@example.com",
      }),
      false,
    );
  });

  it("refuses when the provider supplied no email at all", () => {
    assert.equal(
      mayLinkToExistingUser({
        providerEmail: null,
        providerEmailVerified: true,
        existingUserEmail: "user@example.com",
      }),
      false,
    );
  });

  it("compares emails case-insensitively and ignoring surrounding space", () => {
    assert.equal(
      mayLinkToExistingUser({
        providerEmail: "  User@Example.COM ",
        providerEmailVerified: true,
        existingUserEmail: "user@example.com",
      }),
      true,
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./linking.ts`.

- [ ] **Step 3: Implement**

`src/lib/auth/linking.ts`:

```ts
const normalize = (email: string) => email.trim().toLowerCase();

export const mayLinkToExistingUser = ({
  providerEmail,
  providerEmailVerified,
  existingUserEmail,
}: {
  providerEmail: string | null | undefined;
  providerEmailVerified: boolean;
  existingUserEmail: string;
}): boolean => {
  if (!providerEmail) return false;
  if (!providerEmailVerified) return false;

  return normalize(providerEmail) === normalize(existingUserEmail);
};
```

- [ ] **Step 4: Run and confirm green**

Run: `npm test`
Expected: 5 new cases PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/linking.ts src/lib/auth/linking.test.ts
git commit -m "feat(auth): verified-email-only account linking rule"
```

---

### Task 6: Convex adapter functions

**Files:**
- Create: `convex/authAdapter.ts`
- Modify: `convex/schema.ts` (no change if Task 1 complete)

**Interfaces:**
- Produces Convex functions: `createUser`, `getUserById`, `getUserByEmail`, `getUserByAccount`, `updateUser`, `linkAccount`, `unlinkAccount`, `createVerificationToken`, `useVerificationToken`, `getCredentialByEmail`, `setCredential`.

**Resolve the open mechanism question first.** The spec leaves one thing deliberately unsettled: whether these are `internalMutation`s called from Next with the Convex deploy key, or ordinary mutations guarded by `INTERNAL_API_KEY`.

- [x] **Step 1: Spike the preferred mechanism — DONE, and it reversed the preference**

Probe (`convex/authAdapterProbe.ts`, since deleted) deployed an `internalQuery`
and a public `query`, then called both from a Next-side context:

```
PUBLIC  call: public-ok
INTERNAL call (no key) REJECTED: Server Error
CONVEX_DEPLOY_KEY present: false
```

Internal functions are genuinely unreachable from outside Convex — good. But
reaching them *deliberately* from Next requires the **Convex deploy key**, and
there is no narrower credential: a deploy key can deploy code, read and write
every table, and rewrite environment variables. Putting one in the app server's
runtime turns "the Next server was compromised" into "the entire Convex
deployment was compromised", which is a strictly larger blast radius than the
data access the adapter actually needs.

**Decision: the second option.** Ordinary mutations whose first act is to
compare a dedicated `AUTH_ADAPTER_SECRET` in constant time. The plan originally
preferred internal functions; the spike is why it does not any more.

A dedicated secret rather than reusing `INTERNAL_API_KEY`: that one guards
Convex calling *into* Next, and sharing one credential across both directions
means a leak in either direction compromises both.

- [ ] **Step 2: Implement the user and account functions**

Each function is thin: a single indexed lookup or a single write. Use `by_provider_account` for `getUserByAccount`, `by_email` for `getUserByEmail`, `by_user` for credentials. `createUser` sets `streamUserId` to the new document id immediately after insert:

```ts
    const userId = await ctx.db.insert("users", { ...fields });
    // New users are their own Stream identity. Migrated users keep their Clerk
    // id instead — see convex/migrations/authBackfill.ts.
    await ctx.db.patch(userId, { streamUserId: userId });
```

- [ ] **Step 3: Implement the verification token functions**

`createVerificationToken` stores only `tokenHash`. `useVerificationToken` looks up by `by_identifier_token`, **deletes the row before returning it**, and returns `null` if it is missing or `expires` is in the past. Deleting before returning is what makes a magic link single-use; returning first and deleting after leaves a window where two concurrent requests both succeed.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add convex/authAdapter.ts
git commit -m "feat(auth): Convex functions backing the Auth.js adapter"
```

---

### Task 7: The Auth.js adapter

**Files:**
- Create: `src/lib/auth/convexAdapter.ts`, `src/lib/auth/convexAdapter.test.ts`

**Interfaces:**
- Consumes: the Convex functions from Task 6.
- Produces: `convexAdapter(): Adapter` satisfying `next-auth`'s `Adapter` type.

- [ ] **Step 1: Install next-auth**

```bash
npm install next-auth@beta
```

- [ ] **Step 2: Write tests against a fake Convex client**

Inject the Convex caller so the adapter is testable without a live deployment.
Define the injected type in this file — it is the seam the tests substitute:

```ts
/** Narrow enough that a test can pass a plain object literal. */
export type ConvexCaller = {
  query: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  mutation: (name: string, args: Record<string, unknown>) => Promise<unknown>;
};

export const convexAdapter = (call: ConvexCaller): Adapter => ({ ... });
```

Assert: `createUser` returns an object with `id`; `getUserByEmail` returns `null` for an unknown address; `useVerificationToken` returns `null` the second time the same token is presented.

- [ ] **Step 3: Run and watch it fail, then implement, then confirm green**

Implement only the nine methods the spec lists. Omit `createSession`, `getSessionAndUser`, `updateSession`, `deleteSession` — the JWT strategy never calls them, and stubs that throw are clearer than stubs that silently return.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/convexAdapter.ts src/lib/auth/convexAdapter.test.ts package.json package-lock.json
git commit -m "feat(auth): Auth.js adapter over Convex"
```

---

## Phase 2 — Auth.js wiring

### Task 8: Split Auth.js config

**Files:**
- Create: `src/auth.config.ts`, `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`

The split exists because middleware runs on Edge and cannot load argon2 or the adapter. Keep `src/auth.config.ts` free of both — if middleware starts failing to build, something Node-only leaked into it.

- [ ] **Step 1: Edge-safe config with the OAuth providers**

`src/auth.config.ts` holds `providers: [Google, GitHub]` plus `pages: { signIn: "/signin" }`. No adapter, no Credentials `authorize` body, no imports from `src/lib/auth/password.ts`.

- [ ] **Step 2: Full instance**

`src/auth.ts` spreads the edge config, adds `adapter: convexAdapter(...)`, `session: { strategy: "jwt" }`, the Credentials provider whose `authorize` calls `getCredentialByEmail` then `verifyPassword`, the email provider whose `sendVerificationRequest` calls the existing `sendEmail`, and a `signIn` callback that enforces `mayLinkToExistingUser`.

The `jwt` and `session` callbacks must put the **Convex user id** on the session, because that is what Task 9 signs into the Convex token.

- [ ] **Step 3: Route handlers**

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 4: Wire auth failures into the existing observability path**

The Clerk webhook was the app's source of auth operational events. Removing it
without replacing it leaves a blind spot exactly where one matters. In the Auth.js
`events` and in the `signIn` callback's failure branches, call the existing
`recordOperationalEvent` mutation with `provider: "authjs"`, mirroring the shape
already used in `convex/http.ts`:

```ts
  await recordOperationalEvent({
    source: "auth",
    scope: "authjs.signin",
    level: "warn",
    message: "Sign-in rejected.",
    provider: "authjs",
    status: "rejected",
    correlationId,
  });
```

Log the *fact* of a rejection and its scope. Never log the submitted email or
password — a failed sign-in log that records the attempted address turns the log
into the user-enumeration oracle the generic error message exists to prevent.

- [ ] **Step 5: Verify sign-in works end to end for one provider**

Run: `npm run dev`, sign in with Google.
Expected: a session cookie is set and `await auth()` in a server component returns a user whose id is a Convex id.

- [ ] **Step 6: Commit**

```bash
git add src/auth.config.ts src/auth.ts "src/app/api/auth/[...nextauth]/route.ts"
git commit -m "feat(auth): Auth.js configuration split for Edge"
```

---

### Task 9: The token route and the client bridge

**Files:**
- Create: `src/app/api/auth/convex-token/route.ts`, `src/components/providers/ConvexAuthProvider.tsx`
- Modify: `src/lib/routeAccess.ts`, `src/app/layout.tsx`

- [ ] **Step 1: The token route**

Reads the session with `await auth()`. No session means `401` — not a redirect, because the caller is `fetch` from the Convex client and a redirect would arrive as opaque HTML. Mints with `mintConvexToken` using `AUTH_JWT_PRIVATE_KEY`, `AUTH_JWT_KID` and `NEXT_PUBLIC_APP_URL` normalised through the existing `siteUrl` helper from `src/lib/siteUrl.ts`. Sets `cache-control: no-store`. `export const runtime = "nodejs"`.

- [ ] **Step 2: The provider**

`ConvexAuthProvider` wraps `SessionProvider` around `ConvexProviderWithAuth`, passing a `useConvexAuthBridge` hook shaped exactly as Convex requires:

```ts
  return useMemo(
    () => ({ isLoading, isAuthenticated, fetchAccessToken }),
    [isLoading, isAuthenticated, fetchAccessToken],
  );
```

`fetchAccessToken({ forceRefreshToken })` must bypass any local cache when `forceRefreshToken` is true — Convex sets it when a token was rejected, and returning a cached token there produces an infinite retry loop.

- [ ] **Step 3: Swap the provider in the layout**

Replace `ConvexClerkProvider` with `ConvexAuthProvider` in `src/app/layout.tsx`. Leave `ConvexClerkProvider.tsx` on disk until Task 14.

- [ ] **Step 4: Verify a Convex query runs authenticated**

Sign in, then confirm `getCurrentUser` returns a user rather than `null`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/convex-token src/components/providers/ConvexAuthProvider.tsx src/app/layout.tsx src/lib/routeAccess.ts
git commit -m "feat(auth): mint Convex tokens from the Auth.js session"
```

---

### Task 10: Convex identity resolution

**Files:**
- Modify: `convex/lib/errorUtils.ts`, `convex/users.ts`

The whole point of the earlier survey: this is the only place Convex learns who the caller is.

- [ ] **Step 1: Point `getCurrentUser` at the document id**

`identity.subject` is now the Convex user id, so `convex/users.ts:265-270` becomes a direct `ctx.db.get(identity.subject as Id<"users">)` rather than a `by_clerk_id` lookup. Keep a `by_legacy_clerk_id` fallback for one release so a stale Clerk token in flight during deploy still resolves.

- [ ] **Step 2: Typecheck and run the suite**

Run: `npm run typecheck && npm test`

- [ ] **Step 3: Commit**

```bash
git add convex/lib/errorUtils.ts convex/users.ts
git commit -m "feat(auth): resolve Convex identity from the new subject"
```

---

## Phase 3 — UI

### Task 11: Session primitives

**Files:**
- Create: `src/components/auth/SessionGuards.tsx`, `src/hooks/useCurrentUser.ts`
- Modify: the 24 `SignedIn`/`SignedOut` call sites, the 12 `useUser` call sites

Export the replacements under the **same names** so each call site changes by import line only. Resist renaming here; a rename turns a mechanical 24-file change into 24 opportunities for a mistake.

- [ ] **Step 1: Implement `SignedIn` / `SignedOut` over `useSession()`**

```tsx
"use client";
import { useSession } from "next-auth/react";

/**
 * Deliberately named after the Clerk components they replace, so the 24 call
 * sites change by import line only.
 */
export function SignedIn({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  // "loading" renders nothing: rendering children first makes signed-out users
  // flash authenticated content before the session resolves.
  return status === "authenticated" ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  return status === "unauthenticated" ? <>{children}</> : null;
}
```

- [ ] **Step 2: Implement `useCurrentUser()` over `useSession()` + the existing `getCurrentUser` query**
- [ ] **Step 3: Rewrite imports across the call sites**
- [ ] **Step 4: Typecheck, run the suite, commit**

```bash
git commit -m "feat(auth): local session guards and current-user hook"
```

---

### Task 12: Sign-in, sign-up and reset forms

**Files:**
- Modify: `src/app/signin/page.tsx`, `src/app/signup/page.tsx`
- Create: `src/app/reset-password/page.tsx`, `src/components/auth/UserMenu.tsx`

- [ ] **Step 1: Sign-in form** — email+password, Google, GitHub, and magic link. One generic error message for every credential failure.
- [ ] **Step 2: Sign-up form** — enforces `MIN_PASSWORD_LENGTH` client-side and server-side.
- [ ] **Step 3: Reset flow** — request sends a verification token by email; the form consumes it via `useVerificationToken` and writes through `setCredential`.
- [ ] **Step 4: `UserMenu`** replacing `UserButton` in `Navbar.tsx`.
- [ ] **Step 5: Rate-limit the sign-in, magic-link and reset endpoints** with `consumeRateLimit` from `src/lib/rateLimit.ts`.
- [ ] **Step 6: Typecheck, run the suite, commit**

---

## Phase 4 — Server call sites

### Task 13: Middleware and server routes

**Files:**
- Modify: `src/middleware.ts`, `src/actions/stream.actions.ts`, `src/app/api/execute/route.ts`, `src/app/api/invitations/route.ts`, `src/app/api/telemetry/route.ts`

- [ ] **Step 1: Swap `clerkMiddleware` for the Auth.js `auth()` middleware**

Preserve exactly: the `isPublicRoute` check, the relative-path `redirect_url` (its comment records that an absolute URL broke behind nginx), and the correlation-id header and cookie. Import from `src/auth.config.ts`, never `src/auth.ts`.

- [ ] **Step 2: Replace `currentUser()` with `await auth()` in the four server files**

In `stream.actions.ts`, `generateUserToken` must take `streamUserId` from the Convex user record, **not** the session id. This is the line that decides whether migrated users keep their recordings.

- [ ] **Step 3: Extend `routeAccess.test.ts`** to prove public routes are unchanged.
- [ ] **Step 4: Typecheck, run the suite, commit**

---

## Phase 5 — Migration

### Task 14: Backfill

**Files:**
- Create: `convex/migrations/authBackfill.ts`

- [ ] **Step 1: Write the idempotent backfill**

For every user lacking `legacyClerkId`: set `legacyClerkId = clerkId`, `streamUserId = clerkId`. Skip rows already carrying both, so it can be re-run safely after a partial failure.

- [ ] **Step 2: Run against dev and verify counts**

Run: `npx convex run migrations/authBackfill:run`
Expected: processed count equals the user count; a second run reports zero.

- [ ] **Step 3: Verify a migrated user resolves**

Confirm `streamUserId` on a migrated row equals the old Clerk id.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(auth): idempotent backfill for legacy Clerk identities"
```

---

### Task 15: Cutover

- [ ] **Step 1: Deploy with both paths live.** Clerk stays configured.
- [ ] **Step 2: Run the backfill against production.**
- [ ] **Step 3: Email every user a set-your-password link.** Clerk hashes cannot be exported; OAuth and magic-link users need no action.
- [ ] **Step 4: Manual verification gate.** Sign in by each of the four methods. Open a past recording as a migrated user. **Do not proceed to Task 16 until this passes.**

---

## Phase 6 — Removal

### Task 16: Remove Clerk

Only after Task 15 step 4 passes. This is the irreversible step.

- [ ] **Step 1: Delete the webhook.** Remove the `/clerk-webhook` route from `convex/http.ts` and drop the `svix` dependency.
- [ ] **Step 2: Delete Clerk code.** `src/lib/clerkAppearance.ts`, `src/components/providers/ConvexClerkProvider.tsx`, and the `by_legacy_clerk_id` fallback added in Task 10.
- [ ] **Step 3: Uninstall.** `npm uninstall @clerk/nextjs svix`
- [ ] **Step 4: Make `clerkId` optional, then drop it.** Two separate schema pushes — Convex will not accept removing a required field in one step.
- [ ] **Step 5: Purge env.** Remove `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `CLERK_ISSUER_URL` from `.env.example`, the deploy secrets and the Convex environment.
- [ ] **Step 6: Confirm no Clerk references remain**

Run: `grep -rn "clerk\|Clerk" src/ convex/ --include="*.ts" --include="*.tsx"`
Expected: no matches outside comments describing the migration.

- [ ] **Step 7: Full validation and commit**

```bash
npm run ci:validate
git commit -m "chore(auth): remove Clerk"
```

---

## Notes for the executor

- `convex/http.ts` has an uncommitted local change replacing `req.json()` with `req.text()` in the Clerk webhook — a signature-verification fix. Task 16 deletes that handler, so the fix becomes moot. Confirm with the owner before discarding it.
- Task 6 step 1 is a genuine spike. Do not guess the mechanism; the two options have different security properties.
- Tasks 1 through 13 are reversible. Task 16 is not.
