# Replacing Clerk with Auth.js — design

**Date:** 2026-09-12
**Status:** awaiting review
**Decision owner:** Kunj Hirapara

## Why

Clerk is a paid third party holding the identity of every interviewer, recruiter
and candidate. Replacing it moves that data into the Convex deployment we already
run, removes a per-seat cost, and removes an outage we cannot fix ourselves.

The cost is real and worth naming up front: Auth.js stores its session in a
Next.js cookie, while Convex authorises every function call against a JWT it
verifies itself. Those are two systems that must agree about who the user is. The
design below confines that disagreement to exactly one seam — a single
token-minting route and its JWKS — rather than letting it spread across the app.

## What exists today

| Layer | Clerk surface |
| --- | --- |
| Client | `ClerkProvider` + `ConvexProviderWithClerk`; 12 `useUser`, 18 `SignedIn`, 6 `SignedOut`, 3 `UserButton`, 5 `SignIn`, 2 `SignUp`, 2 `useClerk` |
| Next server | `clerkMiddleware` in `src/middleware.ts`; `auth()`/`currentUser()` in the Stream action, execute route, invitations route, telemetry route |
| Convex | `convex/auth.config.ts` registers Clerk as an OIDC provider; Convex fetches Clerk's JWKS and verifies tokens itself |
| Authorization | 3 `getUserIdentity()` calls, funnelled through `requireIdentity()` in `convex/lib/errorUtils.ts`; `requirePermission()` in `convex/lib/authz.ts` used by 10 modules |
| Data | `users.clerkId` with a `by_clerk_id` index; `auditLogs.actorClerkId` |
| Sync | `convex/http.ts` `/clerk-webhook`, svix-verified |
| Video | `streamTokenProvider` mints a Stream token with `user_id: <clerk id>` |

The authorization layer is the good news. Because everything funnels through
`requireIdentity()`, the Convex side changes in one file plus a config, not in ten
modules.

## Decisions taken

| Decision | Choice | Why |
| --- | --- | --- |
| Auth library | Auth.js v5 (`next-auth@5`) | Chosen by the decision owner over Convex Auth |
| Methods | Email+password, Google, GitHub, magic link | All four requested |
| Session strategy | **JWT**, not database | The Auth.js Credentials provider does not support database sessions. A library constraint, not a preference. |
| Adapter | **Custom Convex adapter, required** | Magic link needs somewhere to store verification tokens, and OAuth needs account linking. Both require an adapter even under a JWT session strategy. |
| Convex provider type | `customJwt`, not OIDC | `customJwt` needs only a JWKS endpoint. Full OIDC would additionally require serving `/.well-known/openid-configuration`. |
| Existing users | Migrated, not reset | Real production users exist |

## Architecture

Three parties, one seam between them:

```
Browser --(Auth.js session cookie)--> Next.js
                                        |
                                        |  GET /api/auth/convex-token
                                        |  mints short-lived RS256 JWT
                                        v
                                   Convex client --(Bearer JWT)--> Convex
                                                                      |
                                        GET /.well-known/jwks.json <--+
                                        (Convex verifies signature)
```

Auth.js owns *proving who you are*. Convex remains the source of truth for *what
you may do* — user records, roles and `requirePermission()` are untouched.

### The seam, precisely

1. Next.js holds an RSA private key (`AUTH_JWT_PRIVATE_KEY`, PKCS8 PEM, in env).
2. `GET /api/auth/convex-token` reads the Auth.js session and, if valid, signs a
   JWT with `sub` = the Convex user id, `aud` = `"convex"`, `iss` = the app URL, a
   `kid` header, and a **10 minute** expiry.
3. `GET /.well-known/jwks.json` publishes the matching public key. Convex fetches
   and caches it.
4. `convex/auth.config.ts` declares a `customJwt` provider pointing at that JWKS.
5. `ctx.auth.getUserIdentity().subject` is therefore the Convex user id.

The short expiry is what makes revocation work. Signing out clears the cookie, so
the next mint fails and the Convex token dies within ten minutes. A longer token
would outlive sign-out.

**`kid` is present from day one.** Without a key id in the header, rotating the
signing key means a window where valid tokens fail verification. Including it now
costs nothing and makes rotation a non-event later.

## Components

### 1. Convex data model

New tables, all owned by the adapter:

- `authAccounts` — OAuth links. Indexed `by_provider_account` (`provider`,
  `providerAccountId`) and `by_user`.
- `authVerificationTokens` — magic-link and email-verification tokens. Indexed
  `by_identifier_token`. Stores a **hash** of the token, never the token itself.
- `authCredentials` — one row per password user: `userId`, `passwordHash`,
  `updatedAt`. Kept out of `users` so a password hash is never returned by an
  existing user query by accident.

Changes to `users`:

- `clerkId` renamed to `legacyClerkId` and made **optional**. Retained only for
  audit trails and support lookups.
- `streamUserId` — **new.** Set to the old Clerk ID for migrated users and to the
  Convex user id for new ones. Declared `v.optional(v.string())` in the schema,
  because Convex rejects a required field that existing rows lack; the backfill
  fills every row, and application code treats a missing value as a bug rather
  than a supported state.
- `emailVerified` — optional timestamp.
- `by_clerk_id` index becomes `by_legacy_clerk_id`, kept for the migration and for
  support.

`streamUserId` is the subtle one. Stream.io call and recording history is keyed by
the Clerk ID we passed as `user_id`. If new tokens use a different id, every
migrated user silently loses access to their own past recordings. Storing the
Stream identity explicitly decouples "who you are to us" from "who you are to
Stream", and is the difference between a clean migration and silent data loss.

`auditLogs` gains an optional `actorUserId`; `actorClerkId` stays optional for
existing rows. No backfill — old rows keep meaning what they meant.

### 2. Convex Auth.js adapter

`src/lib/auth/convexAdapter.ts` implements the Auth.js `Adapter` interface against
Convex via `fetchQuery`/`fetchMutation`, backed by internal Convex functions in
`convex/authAdapter.ts`.

Methods required for our provider set: `createUser`, `getUser`, `getUserByEmail`,
`getUserByAccount`, `updateUser`, `linkAccount`, `unlinkAccount`,
`createVerificationToken`, `useVerificationToken`. Session methods are omitted —
the JWT strategy never calls them.

The adapter surface must never be callable from a browser — it can create users
and link accounts. Two mechanisms are available, and **phase 1 must confirm which
before the adapter is written**:

- `internalMutation`/`internalQuery`, invoked from the Next server with the Convex
  deploy key. Strongest isolation: internal functions have no public endpoint at
  all. Preferred if calling them from Next proves practical.
- Ordinary mutations guarded by the shared `INTERNAL_API_KEY`, the pattern this
  repo already uses for `/api/notifications/email`. Weaker, but proven here.

Take the first if it works; fall back to the second only if it does not. This is
the one open mechanism question in the design, and it is deliberately settled by
experiment rather than guessed at here.

### 3. Auth.js configuration, split for Edge

Next.js middleware runs on the Edge runtime, which cannot run argon2 or the Convex
adapter. Auth.js's documented answer is a two-file split:

- `src/auth.config.ts` — providers only, no adapter, no Node APIs. Edge-safe.
  Imported by middleware.
- `src/auth.ts` — the full `NextAuth()` instance: adapter, callbacks, Credentials
  `authorize`. Node runtime. Imported by routes and server actions.

Providers: `Credentials` (email+password), `Google`, `GitHub`, and a
`type: "email"` provider whose `sendVerificationRequest` uses the existing
`sendEmail` from `src/lib/email` — no new mail infrastructure.

### 4. Password handling

- Hash with **argon2id**, verified in the Node runtime only.
- Sign-in, sign-up, magic-link request and password-reset endpoints all pass
  through the existing `consumeRateLimit` from `src/lib/rateLimit.ts`.
- Failed sign-in returns one generic message. Distinguishing "no such user" from
  "wrong password" is a user-enumeration oracle.

### 5. Account linking

Linking an OAuth identity to an existing email address happens **only when the
OAuth provider reports that email as verified**. Otherwise anyone who can create
an unverified account at a provider using a victim's email address inherits that
victim's account. This is the highest-risk decision in the design and the
implementation must fail closed.

### 6. Client

- `ConvexClerkProvider` becomes `ConvexAuthProvider`: the Auth.js `SessionProvider`
  wrapping `ConvexProviderWithAuth`.
- A `useConvexAuthBridge()` hook returning `{ isLoading, isAuthenticated,
  fetchAccessToken }`, where `fetchAccessToken({ forceRefreshToken })` calls
  `/api/auth/convex-token` and bypasses its cache when `forceRefreshToken` is true.
- `SignedIn` / `SignedOut` become local components over `useSession()`, keeping the
  same names so the 24 call sites change by import only.
- `useUser` becomes a local `useCurrentUser()` over `useSession()` plus the
  existing `getCurrentUser` Convex query.
- `UserButton` becomes a local dropdown (avatar, name, settings, sign out).
- Clerk's hosted `<SignIn>` / `<SignUp>` become our own forms on the existing
  `/signin` and `/signup` routes. `src/lib/clerkAppearance.ts` is deleted.

### 7. Next.js server call sites

`clerkMiddleware` becomes the Auth.js `auth()` middleware. The `PUBLIC_ROUTES`
table, `redirect_url` handling and correlation-id cookie logic in
`src/middleware.ts` are preserved exactly — that file has already been debugged
twice and its comments record why each behaviour exists.

`currentUser()` becomes `await auth()` in the Stream action, execute route,
invitations route and telemetry route. The Stream action reads `streamUserId` from
the Convex user rather than the session id.

### 8. Migration and cutover

Run while Clerk is still live:

1. **Backfill** (`convex/migrations/authBackfill.ts`, idempotent): for every user,
   set `legacyClerkId = clerkId`, `streamUserId = clerkId`, and `emailVerified`
   from the existing Clerk-sourced data.
2. **Deploy** the new stack with both paths present.
3. **Invite** every user to set a password via the reset flow. Clerk password
   hashes cannot be exported, so this is unavoidable; OAuth and magic-link users
   can sign in immediately without it.
4. **Verify** a migrated account can sign in, load its interviews, and open a past
   recording.
5. **Remove** Clerk: packages, env vars, `/clerk-webhook`, svix, and the
   `by_legacy_clerk_id` reads.

Steps 1–2 are reversible. Step 5 is the point of no return and happens only after
step 4 passes.

## Error handling

- Token mint with no valid session returns `401`, and the client treats it as
  signed out rather than retrying.
- JWKS fetch failure on Convex's side means Convex rejects the token; the client
  surfaces the existing "you must be signed in" error from `requireIdentity()`.
- Adapter write failure during OAuth sign-in fails closed with a generic error; no
  partial user row is left behind.
- All auth failures are recorded through the existing `recordOperationalEvent`
  observability path, replacing the Clerk webhook events with `provider: "authjs"`.

## Testing

Unit tests (`node:test`, matching the existing suite):

- JWT mint/verify round trip: claims, expiry, `kid`, and rejection of a token
  signed by the wrong key.
- Adapter methods against a Convex test instance.
- Password hash/verify, including rejection of a wrong password.
- Verification-token single use: a token cannot be redeemed twice.
- Account linking refuses an unverified OAuth email.
- `PUBLIC_ROUTES` behaviour is unchanged (extend the existing `routeAccess.test.ts`).

Manual gate before Clerk removal: sign in by each of the four methods, confirm the
Convex token is accepted, and confirm a migrated user reaches their old recordings.

## Risks

| Risk | Mitigation |
| --- | --- |
| Two sources of session truth drift | One seam only: the token route. Nothing else reads the cookie to decide identity. |
| Account takeover via unverified OAuth email | Link only on provider-verified emails; fail closed. |
| Migrated users lose Stream recording history | Explicit `streamUserId`, carried from the Clerk ID. |
| Users locked out during cutover | Clerk stays live through steps 1–4; OAuth and magic link work without a password reset. |
| Signing key compromise | `kid` from day one; rotation is a JWKS publish plus an env change. |
| Password hashing on Edge | Split config; `authorize` runs in the Node runtime only. |

## Out of scope

Multi-factor auth, organisations/teams as an auth concept, session device
management, and SSO/SAML. None are present today and none are required to reach
parity with the current Clerk setup.
