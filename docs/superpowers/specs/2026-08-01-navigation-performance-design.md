# Navigation performance — trimming the blocking path

**Date:** 2026-08-01
**Status:** Approved, not yet implemented

## Problem

Moving between pages feels very slow. Worse on the deployed VM than locally,
though present in both. Dev-mode compile lag is a separate matter and is out of
scope: Turbopack compiles each route on first visit, which never affects
production.

## Root causes

Ordered by impact on a single navigation.

### 1. Middleware makes two blocking network round-trips per protected navigation

`src/middleware.ts:22-38`. For any path matching `PROTECTED_ROUTES`
(`/dashboard*`, `/schedule`, `/recordings`) the middleware:

1. awaits `getToken({ template: "convex" })`, minting a JWT through Clerk;
2. constructs a **new** `ConvexHttpClient` per request, so there is no
   connection reuse and each navigation pays a fresh TLS handshake;
3. awaits `convex.query(api.users.getCurrentUser)`.

These run in sequence, before the page can begin rendering. They also run on
client-side navigations, because the App Router fetches the RSC payload from the
same URL and middleware matches it. The client then fetches the *same*
`getCurrentUser` again through `useUserRole`, so the role is resolved twice per
navigation over two different transports.

### 2. No loading boundaries anywhere

There is not a single `loading.tsx` in `src/app`. Without one, clicking a link
to a dynamic route leaves the browser parked on the **old page** with no
feedback until the server responds. Combined with cause 1, a navigation appears
frozen for the whole round-trip. This is the largest contributor to the app
*feeling* slow, as distinct from being slow.

`src/app/(admin)/dashboard/layout.tsx` also sets `export const dynamic =
"force-dynamic"`, opting every dashboard route out of caching.

### 3. Heavy shared bundle

3.7 MB of client JS in `.next/static/chunks`; largest single chunk 467 KB.

- `@stream-io/video-react-sdk/dist/css/styles.css` is imported by the **root**
  layout (`src/app/layout.tsx:3`), so every page — including the public landing
  page — downloads Stream's stylesheet.
- `StreamVideoClient` and `StreamVideo` are statically imported by
  `StreamClientProvider`, which wraps every signed-in route. The provider is
  already careful not to *initialize* Stream away from `/meeting`, `/schedule`
  and `/recordings`, but the SDK is still in the bundle graph for every route.

### 4. Full-table scans that degrade as users arrive

`convex/admin.ts:94-96` — `getAdminDashboard` collects the entire `interviews`,
`users` and `feedback` tables on every dashboard load, then slices to 100. It
also calls `requirePermission` and then `getCurrentUserRecord` again, a
duplicated user lookup. Inside the map it runs `feedback.filter(...)` per
interview, which is O(interviews × feedback). There are 30 `.collect()` calls
across `convex/`. This is harmless at ten users and is exactly what degrades
under the public launch this work is preparing for.

### 5. Four-step client waterfall (deferred)

Clerk loads → Convex authenticates → `syncUser` mutation → `getCurrentUser`
query, all serial, before `useUserRole` resolves. That hook gates the navbar and
most page content.

## Approach

Chosen: **trim the blocking path**. Rejected alternatives:

- *Role in Clerk session claims* — zero network hops in middleware, but requires
  Clerk dashboard configuration and writing role changes back into Clerk
  metadata, creating a second source of truth that can drift from Convex.
- *Perceived-speed only* — loading states and bundle splitting alone. Cheapest,
  but leaves the real per-navigation latency in place.

## Design

### Middleware stops talking to Convex

Middleware keeps `auth.protect()` and the correlation-id handling. The role gate
is deleted. The check moves to `RoleGuard`, which already exists and already
ANDs its role and permission checks correctly, driven by the same
`PROTECTED_ROUTES` table so there remains one source of truth for which roles a
route allows.

**This is not a security regression.** Every Convex function re-checks with
`requirePermission`; that has always been the real gate, and middleware was
routing convenience. A candidate opening `/dashboard/team` receives an
access-denied state rather than a redirect, and no query returns data.

`RoleGuard` gains a `redirectTo` option so protected pages bounce to `/` instead
of rendering a denial panel, preserving current behaviour.

**Trade-off, stated plainly:** the redirect now happens after the client knows
the role, so there is a brief shell flash where there used to be a clean
server-side redirect. That is the cost of removing two sequential network hops
from every dashboard navigation.

### Loading boundaries

Add `loading.tsx` for the `(root)` and `(admin)/dashboard` segments, reusing the
skeleton components already in the codebase rather than inventing new ones, so a
click paints immediately.

Remove `export const dynamic = "force-dynamic"` from the dashboard layout. It
predates the middleware role gate and is not needed once the layout itself does
no request-time data fetching: the dashboard's data all arrives through client
side Convex subscriptions, which are live regardless of how the shell is
rendered. If removing it turns out to break a route, that route gets the
directive back individually rather than the whole segment keeping it.

### Bundle

Move the Stream stylesheet out of the root layout into the segments that render
video. Load the `StreamVideo` wrapper through `next/dynamic` so the SDK is
fetched when a video route mounts rather than sitting in every route's graph.

### Convex queries

In `getAdminDashboard`:

- collapse the duplicated `requirePermission` / `getCurrentUserRecord` lookup;
- add a `by_start_time` index on `interviews` and paginate to the 100 rows the
  query already slices to, instead of collecting three whole tables;
- group feedback by interview once into a `Map` rather than filtering the full
  feedback array inside the per-interview map.

## Testing and verification

- `npm run ci:validate` (typecheck, tests, production build) must pass.
- Record `.next/static/chunks` total bytes before and after.
- Time the middleware before and after, and confirm the dashboard renders for an
  admin and is refused for a candidate.

Because the behavioural change is a routing/authorization boundary, the
candidate-refused case must be exercised by hand rather than assumed.

## Result

Implemented 2026-08-01.

**Middleware.** Both round-trips are gone. `/dashboard*`, `/schedule` and
`/recordings` no longer mint a Clerk JWT or open a Convex connection before
rendering. Role gating moved to `RoleGuard` via a new
`getRequiredRolesForPath`, so `PROTECTED_ROUTES` is still the only place role
requirements are written down.

A side effect worth recording: dropping `force-dynamic` moved all five dashboard
routes from `ƒ` (server-rendered on demand) to `○` (prerendered static shells).

**Loading boundaries.** Added for `(root)` and the dashboard segment — the first
in the app.

**Bundle.** Stream's *JavaScript* is now absent from `/`, `/practice`,
`/calendar`, `/dashboard` and `/settings`, verified by scanning the assets each
prerendered page references. Two static import chains had to be cut: the
provider's own `StreamVideoClient` import, and `/` → `MeetingModal` →
`useMeetingActions` → `useStreamVideoClient`.

Stream's *stylesheet*, 127 KB, still reaches those routes. Turbopack merges CSS
across a route group, so moving the import out of the root layout to the meeting
route was a semantic fix rather than a saving. Separating it would require giving
`/meeting` its own route group and shell; not attempted.

Total bytes on disk rose from 3.7 MB to roughly 4.1 MB, because code-splitting
duplicates rather than moves. That figure is the wrong one to optimise: what
changed is bytes *per route*, and the SDK is no longer among them for the five
routes above.

**Convex.** `getAdminDashboard` no longer reads the caller's user row twice, and
two O(interviews × feedback) scans became hash lookups. Output is unchanged by
construction. The three `.collect()` calls remain — see the plan for why
pagination would have altered the displayed figures.

**Not verified.** The candidate-is-refused path on `/dashboard`,
`/dashboard/team`, `/schedule` and `/recordings` needs a real signed-in session
with a `candidate` account and has not been exercised. Since this work moved an
authorization boundary from the server to the client, that check should be done
before merging.

## Out of scope

Root cause 5, the client waterfall. The middleware change already removes its
worst symptom — `getCurrentUser` resolved twice per navigation — and
restructuring the Clerk/Convex client auth chain is a much larger change. Revisit
only if navigation still drags afterwards.
