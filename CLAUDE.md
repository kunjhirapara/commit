# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Next.js dev server
npx convex dev           # Convex backend — needs its own terminal, and dev needs both
npm run typecheck        # tsc --noEmit
npm run lint             # ALSO tsc --noEmit. There is no ESLint here.
npm test                 # node --experimental-strip-types --test "src/**/*.test.ts"
npm run build            # next build
npm run ci:validate      # typecheck + test + build — what CI runs
```

Run one test file, or one case:

```bash
node --experimental-strip-types --test src/lib/auth/linking.test.ts
node --experimental-strip-types --test --test-name-pattern "refuses" src/lib/auth/linking.test.ts
```

### The test runner does not understand this project's imports

It is bare `node --test` with type stripping — no bundler, no path mapping. Test
files and anything they reach must therefore use **relative paths with explicit
`.ts` extensions**:

```ts
import { mayLinkToExistingUser } from "./linking.ts";              // yes
import { RETENTION_DAYS } from "../../../convex/lib/retention.ts"; // yes
import { siteUrl } from "@/lib/siteUrl";                           // fails: ERR_MODULE_NOT_FOUND
```

`@/…` aliases and extensionless specifiers work everywhere Next compiles, and
nowhere the test runner looks. This is the reason for the `convex/lib` pattern
described below.

## Architecture

### Three runtimes, and what each cannot do

Code lands in one of three places, and the constraints are not interchangeable:

1. **Next.js server (Node)** — route handlers, server components, `src/auth.ts`.
   Full Node: native modules, `node:crypto`, sockets.
2. **Next.js middleware (Edge)** — `src/middleware.ts`. No native modules, no
   `node:` builtins. It imports `src/auth.config.ts` and nothing else from the
   auth stack; importing `src/auth.ts` fails the build, which is the point.
3. **Convex functions** — a V8 isolate, not Node. `node:crypto` is not something
   to rely on there (see `convex/lib/adapterAuth.ts`, which hand-rolls a
   constant-time compare for this reason).

### Auth: Auth.js owns sessions, Convex owns authorization

Auth.js (v5) holds the session in a cookie. Convex has never heard of that
cookie. They meet at exactly one seam:

`/api/auth/convex-token` mints a short-lived RS256 JWT → the client bridge in
`ConvexAuthProvider` attaches it → Convex verifies it against
`/.well-known/jwks.json`, registered as a `customJwt` provider in
`convex/auth.config.ts`.

Consequences worth knowing before changing anything here:

- **`issuer` must match exactly.** `convex/auth.config.ts` uses `SITE_URL` on the
  Convex deployment; the token route uses `NEXT_PUBLIC_APP_URL`. A trailing
  slash or an http/https mismatch rejects every token, and the symptom is "you
  must be signed in" shown to people who are.
- **Convex statically requires any env var named in `auth.config.ts`**, whether
  or not the code path runs. A conditional guard does not exempt it — a missing
  one fails `convex deploy`.
- **`AUTH_URL` must never be empty.** `@auth/core` does
  `trustHost ??= !!(AUTH_URL ?? ...)`, and `??` falls through only on
  null/undefined — so an empty string yields `trustHost: false` and every Auth.js
  route answers `UntrustedHost`, rendered as "problem with the server
  configuration". An empty variable is worse than an absent one.
- **`src/auth.config.ts` sets `allowDangerousEmailAccountLinking` on both OAuth
  providers**, and that is only safe because the `signIn` callback in
  `src/auth.ts` enforces `mayLinkToExistingUser` first. These are a pair.
  Weakening either one turns the flag into what its name says.

Authorization is **not** decided in middleware or on the client. Every Convex
function re-checks with `requirePermission`; `useUserRole` exists to hide
affordances the server would reject anyway.

### Identity: three different ids for the same person

This is the most common source of silent bugs.

| | |
|---|---|
| `users._id` | Convex document id. What an Auth.js session subject carries. |
| `users.clerkId` | Historical app id. Referenced by `interviewerIds`, `candidateId`, `auditLogs.actorClerkId`. For Auth.js-created users it equals `_id`. |
| `users.streamUserId` | The id **Stream** knows them by — always the original Clerk id. |

Anything talking to Stream must go through `resolveStreamUserId`
(`src/lib/auth/streamIdentity.ts`). Passing the session id instead does not
error: it mints a valid token for a user Stream has never seen, and their calls
and recordings are simply absent.

`convex/lib/subjectResolution.ts` is the one place that turns a token subject
into a user row, and it tries the document id, then `by_clerk_id`, then
`by_legacy_clerk_id`, because a token may come from either provider at any point
in the migration.

### `convex/lib/*` exists so Convex logic can be tested

Convex functions cannot be imported by the test runner. Anything worth testing
is therefore extracted into `convex/lib/` as a module with **no imports at all**
(`retention.ts`, `owner.ts`, `permissions.ts`, `subjectResolution.ts`), and
tested from `src/` via a relative path. A module in `convex/lib` that imports a
sibling becomes untestable, because the runner cannot resolve the extensionless
specifier.

### Code execution

`/api/execute` spawns sibling containers on the host Docker socket — they are
not children of the app container and are not covered by its limits. Caps live
in `src/lib/docker-runner.ts`. The gate in front of it is a verified email, which
is what stands between "anyone on the internet" and "spawns containers on the
host".

### Deployment: publishing is not shipping

CI builds and pushes an image to GHCR and deploys Convex **before** pushing the
image, so the backend is always live before the frontend that depends on it.
Nothing pushes to the VM: Watchtower is meant to pull. `verify-rollout` in
`.github/workflows/deploy.yml` exists because a green build once meant nothing
had actually been deployed for weeks, and it now also fails when the running
image reports it cannot sign anyone in.

The stack is **Portainer-managed**. Portainer keeps its own copy of
`docker-compose.yml`, so repo changes to that file do not reach the VM until
someone updates the stack in Portainer's UI. Env vars only reach the container
if named in that compose file — putting them in the VM's `.env` alone does
nothing.

## Production secrets: never read their values

**Do not read, print, or otherwise cause the display of the value of any
production environment variable or secret.** This applies to the Convex
deployment, the VM's `.env`, the container environment, Portainer, GitHub
Actions secrets, and anything else holding real credentials.

Checking that a variable **exists** is allowed — but only when it is genuinely
necessary to answer the question at hand, and only in a form that cannot print
the value. Otherwise work from `.env.example`, which carries every variable
name, its shape, and a note on what it is for. That file is the reference; the
real values are not.

### Forbidden

These print values. Do not run them, or any variation of them, against
production:

```
npx convex env list --prod
npx convex env get <NAME> --prod
docker exec <container> env
docker exec <container> printenv
docker inspect <container>          # .Config.Env contains every value
cat .env  /  cat .env.local  /  cat .env.production
echo "$SOME_SECRET"
```

Reading `.env.example` is fine and encouraged — it contains only placeholders.

### Allowed, when necessary

Prefer the application's own report, which is designed for this and publishes a
boolean rather than names:

```
curl -s https://commit.kunjdeveloper.com/api/health
```

`integrations.auth` says whether sign-in is configured. When it is false, the
**container log** names what is missing — the endpoint deliberately does not,
because it is public. See `src/lib/auth/readiness.ts`.

If a per-variable existence check is genuinely required, it must print names
only, and it must be **one line**:

```
docker exec commit sh -c 'for v in AUTH_SECRET AUTH_JWT_KID; do [ -n "$(printenv $v)" ] && echo "$v set" || echo "$v MISSING"; done'
```

Never break a command like that across lines when handing it to someone to
paste. A wrapped `[ -n` is split from its `]`, the test becomes a syntax error,
and the shell then executes each **value** as a command — printing the secrets
it was written to avoid printing.

### Why this rule exists

Both of these happened in this repo, in a single session:

1. `npx convex env list --prod` was run to check whether a variable was set. It
   printed every production value, including `AUTH_JWT_PRIVATE_KEY` — a key that
   can mint a valid Convex token for any user. Five secrets needed rotating.
2. A multi-line existence check was pasted into a terminal, wrapped, and
   executed the values. The Google and GitHub OAuth client secrets were
   disclosed and needed rotating.

Neither was necessary. In both cases the question was "is this set?", and in
both cases the answer was available without the value — from `/api/health`, from
the application's own behaviour, or from a correctly written one-line check.

A leaked secret cannot be unleaked. It has to be rotated, on a live system,
usually in a hurry.

## Related

- `.env.example` — every variable, with placeholders and notes.
- `docs/HANDOFF.md` — deployment topology, owner-only actions, and the decisions
  behind them.
- `docs/superpowers/plans/2026-09-12-custom-auth.md` — the Clerk→Auth.js
  migration, including a list of where the plan turned out to be wrong.
- `README.md` — local setup and Docker runtime images. Its auth section still
  describes Clerk and is out of date.
