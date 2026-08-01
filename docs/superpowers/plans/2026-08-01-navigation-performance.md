# Navigation Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the two blocking network round-trips that middleware performs on every protected navigation, give every route an instant loading state, and stop shipping the Stream SDK to routes that never use it.

**Architecture:** Authorization stays exactly where it already is — every Convex function calls `requirePermission`. Middleware drops to authentication only (`auth.protect()`), and route-role gating moves to the existing client-side `RoleGuard`, driven by the same `PROTECTED_ROUTES` table so there is still one source of truth. Loading boundaries and a lazily-loaded Stream provider address the remaining perceived and real cost.

**Tech Stack:** Next.js 16 (App Router, Turbopack, `output: "standalone"`), React 18, Convex, Clerk, `@stream-io/video-react-sdk`, `node:test` via `node --experimental-strip-types`.

## Global Constraints

- No ESLint in this repo. `npm run lint` is `tsc --noEmit`.
- Tests run with `npm test` → `node --experimental-strip-types --test "src/**/*.test.ts"`. Test files import source with an explicit `.ts` extension (`from "./routeAccess.ts"`), which Node's ESM resolver requires.
- Full gate is `npm run ci:validate` = typecheck && test && build.
- Do not add a `Co-Authored-By` trailer or any "Generated with Claude Code" line to commits. The user has explicitly required this.
- Convex generated types are derived from real modules; after adding or renaming a Convex module run `npx convex codegen --typecheck disable`. It syncs only the deployment named in `.env.local` (`CONVEX_DEPLOYMENT=dev`).
- Never use bare `git stash` in this checkout; the stash stack is shared with other sessions.

---

### Task 1: Teach `routeAccess` to answer "what roles does this path need?"

`RoleGuard` call sites currently hard-code their own role lists, which is why middleware needed its own copy. One exported helper lets both the guard and any future caller read `PROTECTED_ROUTES` instead of duplicating it.

**Files:**
- Modify: `src/lib/routeAccess.ts`
- Test: `src/lib/routeAccess.test.ts` (create)

**Interfaces:**
- Consumes: `PROTECTED_ROUTES`, `RouteRule`, `AppRole` (already exported from `src/lib/routeAccess.ts`).
- Produces: `getRequiredRolesForPath(pathname: string): AppRole[] | undefined` — the `allowedRoles` of the first matching rule, or `undefined` when the path has no rule.

- [ ] **Step 1: Write the failing test**

Create `src/lib/routeAccess.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getRequiredRolesForPath,
  isPublicRoute,
} from "./routeAccess.ts";

describe("getRequiredRolesForPath", () => {
  it("returns undefined for a path with no rule", () => {
    assert.equal(getRequiredRolesForPath("/practice"), undefined);
    assert.equal(getRequiredRolesForPath("/calendar"), undefined);
  });

  it("returns the roles for a guarded path", () => {
    assert.deepEqual(getRequiredRolesForPath("/schedule"), [
      "recruiter",
      "admin",
    ]);
  });

  it("prefers the most specific dashboard rule", () => {
    // PROTECTED_ROUTES lists /dashboard/team before the catch-all /dashboard,
    // so the narrower rule must win rather than the broad one.
    assert.deepEqual(getRequiredRolesForPath("/dashboard/team"), [
      "recruiter",
      "admin",
    ]);
    assert.deepEqual(getRequiredRolesForPath("/dashboard"), [
      "interviewer",
      "recruiter",
      "developer",
      "admin",
    ]);
  });

  it("matches nested paths under a guarded segment", () => {
    assert.deepEqual(getRequiredRolesForPath("/recordings/abc123"), [
      "interviewer",
      "recruiter",
      "admin",
    ]);
  });
});

describe("isPublicRoute", () => {
  it("treats the landing and legal pages as public", () => {
    assert.equal(isPublicRoute("/"), true);
    assert.equal(isPublicRoute("/terms"), true);
    assert.equal(isPublicRoute("/privacy"), true);
  });

  it("does not treat app routes as public", () => {
    assert.equal(isPublicRoute("/dashboard"), false);
    assert.equal(isPublicRoute("/practice"), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test "src/lib/routeAccess.test.ts"`
Expected: FAIL — `getRequiredRolesForPath` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/routeAccess.ts`:

```ts
/**
 * The roles a path requires, or undefined when it has no rule.
 *
 * RoleGuard reads this instead of each page repeating its own role list, which
 * is what let the middleware copy drift from the page copy.
 */
export const getRequiredRolesForPath = (
  pathname: string,
): AppRole[] | undefined => findRouteRule(pathname)?.allowedRoles;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test "src/lib/routeAccess.test.ts"`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/routeAccess.ts src/lib/routeAccess.test.ts
git commit -m "feat(routing): expose required roles for a path"
```

---

### Task 2: Give `RoleGuard` a redirect mode

Middleware currently redirects a disallowed role to `/`. When the check moves client-side the guard must do the same, or the change is a visible UX regression rather than only a timing one.

**Files:**
- Modify: `src/components/auth/RoleGuard.tsx`

**Interfaces:**
- Consumes: `useUserRole()` from `src/hooks/useUserRole.ts` — returns `{ role, hasPermission, isLoading }`.
- Produces: `RoleGuard` gains two optional props — `redirectTo?: string` and `fromPathname?: string`. When `redirectTo` is set and the check fails, the guard calls `router.replace(redirectTo)` and renders nothing instead of showing `ErrorState`. When `fromPathname` is set and `allowedRoles` is omitted, the guard derives allowed roles from `getRequiredRolesForPath(fromPathname)`.

- [ ] **Step 1: Add the props and redirect behaviour**

Replace the body of `src/components/auth/RoleGuard.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import ErrorState from "@/components/ui/ErrorState";
import type { AppPermission } from "@/hooks/useUserRole";
import { useUserRole } from "@/hooks/useUserRole";
import { getRequiredRolesForPath, type AppRole } from "@/lib/routeAccess";

function RoleGuard({
  allowedRoles,
  fromPathname,
  requiredPermissions,
  requireAllPermissions = false,
  redirectTo,
  children,
  title = "Access restricted",
  message = "You do not have permission to view this page.",
}: {
  allowedRoles?: AppRole[];
  /** Derive allowed roles from PROTECTED_ROUTES instead of repeating them. */
  fromPathname?: string;
  requiredPermissions?: AppPermission[];
  requireAllPermissions?: boolean;
  /** Redirect instead of rendering a denial panel. Matches what middleware did. */
  redirectTo?: string;
  children: ReactNode;
  title?: string;
  message?: string;
}) {
  const { hasPermission, isLoading, role } = useUserRole();
  const router = useRouter();

  const effectiveRoles =
    allowedRoles ??
    (fromPathname ? getRequiredRolesForPath(fromPathname) : undefined);

  const passesRoleCheck =
    !effectiveRoles || (role ? effectiveRoles.includes(role) : false);
  const passesPermissionCheck =
    !requiredPermissions ||
    requiredPermissions.length === 0 ||
    (requireAllPermissions
      ? requiredPermissions.every((permission) => hasPermission(permission))
      : requiredPermissions.some((permission) => hasPermission(permission)));

  // Both checks must pass. This was an OR, and `passesPermissionCheck` defaults
  // to true when no permissions are supplied — so on the call sites that pass
  // only `allowedRoles`, the condition collapsed to "any user with a role".
  const denied = !isLoading && (!role || !passesRoleCheck || !passesPermissionCheck);

  useEffect(() => {
    if (denied && redirectTo) router.replace(redirectTo);
  }, [denied, redirectTo, router]);

  if (isLoading) return null;
  if (denied && redirectTo) return null;

  if (denied) {
    return (
      <ErrorState
        title={title}
        message={message}
        secondaryAction={
          <Link
            href="/"
            className="text-sm text-primary underline-offset-4 hover:underline">
            Back to home
          </Link>
        }
      />
    );
  }

  return <>{children}</>;
}

export default RoleGuard;
```

- [ ] **Step 2: Verify existing call sites still typecheck**

Run: `npm run typecheck`
Expected: PASS. The seven existing `<RoleGuard allowedRoles={...}>` call sites are unaffected — both new props are optional, and `AllowedRole` was structurally identical to `AppRole`, which is now imported rather than redeclared.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/RoleGuard.tsx
git commit -m "feat(auth): let RoleGuard redirect and read roles from the route table"
```

---

### Task 3: Remove the Convex round-trip from middleware

This is the change that removes the latency. Do it only after Tasks 1 and 2, because the guard must be able to redirect before middleware stops doing so.

**Files:**
- Modify: `src/middleware.ts`
- Modify: `src/app/(root)/schedule/page.tsx`
- Modify: `src/app/(root)/recordings/page.tsx`
- Modify: `src/app/(admin)/dashboard/layout.tsx`

**Interfaces:**
- Consumes: `RoleGuard` with `fromPathname` and `redirectTo` from Task 2; `isPublicRoute` and `findRouteRule` from `src/lib/routeAccess.ts`.
- Produces: middleware that performs no Convex or Clerk-token network calls.

- [ ] **Step 1: Strip the role gate from middleware**

In `src/middleware.ts`, delete the `ConvexHttpClient` import, the `api` import, the `CONVEX_URL` constant, and the whole `if (rule) { ... }` block. Replace the top of the handler with:

```ts
export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // Authentication only. Role gating lives in RoleGuard (see src/lib/routeAccess.ts).
  //
  // This used to mint a Clerk JWT and query Convex through a freshly built
  // ConvexHttpClient — two serial network round-trips, on a new TLS connection,
  // before any protected page could start rendering, and repeated on every
  // client-side navigation because the RSC payload request matches this
  // middleware too. The client then resolved the same role again via
  // useUserRole. Authorization is unaffected: every Convex function re-checks
  // with requirePermission, which was always the real gate.
  if (!isPublicRoute(pathname)) {
    await auth.protect();
  }
```

Keep everything from `const correlationId = ...` onward exactly as it is, and keep the `config.matcher` unchanged. Remove `findRouteRule` from the import if it is no longer referenced.

- [ ] **Step 2: Restore the redirect on the two `(root)` routes that lose it**

`src/app/(root)/schedule/page.tsx` — change its existing guard to redirect:

```tsx
<RoleGuard fromPathname="/schedule" redirectTo="/">
```

`src/app/(root)/recordings/page.tsx` — same treatment on its existing `<RoleGuard>`:

```tsx
<RoleGuard fromPathname="/recordings" redirectTo="/">
```

Leave the other props on those elements as they are.

- [ ] **Step 3: Guard the whole dashboard segment**

`src/app/(admin)/dashboard/layout.tsx` — the four dashboard pages each have their own `RoleGuard`, but the segment itself was protected by middleware. Wrap the shell so a candidate cannot see the dashboard chrome at all:

```tsx
"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import AppShell from "@/components/layout/AppShell";
import RoleGuard from "@/components/auth/RoleGuard";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AppShell>
      <RoleGuard fromPathname={pathname} redirectTo="/">
        <DashboardShell>{children}</DashboardShell>
      </RoleGuard>
    </AppShell>
  );
}
```

Note this drops `export const dynamic = "force-dynamic"`, which is intended — see Task 4. A layout cannot be both `"use client"` and export route config, so the two changes must land together.

- [ ] **Step 4: Verify**

Run: `npm run ci:validate`
Expected: PASS — typecheck, 23 tests, production build.

- [ ] **Step 5: Manual check (required — this is an authorization boundary)**

Start the app, sign in as an account whose role is `candidate`, and visit `/dashboard`, `/dashboard/team`, `/schedule` and `/recordings`. Each must land back on `/`. Then sign in as `admin` and confirm all four render. Do not skip this because the types compile; the behaviour being changed is a routing gate.

- [ ] **Step 6: Commit**

```bash
git add src/middleware.ts "src/app/(root)/schedule/page.tsx" "src/app/(root)/recordings/page.tsx" "src/app/(admin)/dashboard/layout.tsx"
git commit -m "perf(routing): drop the Convex round-trip from middleware"
```

---

### Task 4: Add loading boundaries

**Files:**
- Create: `src/app/(root)/loading.tsx`
- Create: `src/app/(admin)/dashboard/loading.tsx`

**Interfaces:**
- Consumes: `Skeleton` from `src/components/ui/skeleton.tsx` (already used by the home, team, roles and developer pages).
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Create the signed-in shell loading state**

Create `src/app/(root)/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

/**
 * There was no loading.tsx anywhere in the app, so clicking a link left the
 * browser sitting on the previous page with no feedback until the server
 * responded — which is most of why navigation felt frozen.
 */
export default function Loading() {
  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-96" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-36 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the dashboard loading state**

Create `src/app/(admin)/dashboard/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}
```

- [ ] **Step 3: Verify the build still marks routes correctly**

Run: `npm run build`
Expected: PASS. `/dashboard` and its children may now appear as static (`○`) rather than dynamic (`ƒ`) since `force-dynamic` was removed in Task 3; that is the intended outcome, because the dashboard's data arrives through client-side Convex subscriptions rather than request-time rendering.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(root)/loading.tsx" "src/app/(admin)/dashboard/loading.tsx"
git commit -m "perf(ux): add loading boundaries so navigation paints immediately"
```

---

### Task 5: Load the Stream SDK only where video is used

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/providers/StreamVideoRuntime.tsx`
- Modify: `src/components/providers/StreamClientProvider.tsx`

**Interfaces:**
- Consumes: `useUserRole()`, `streamTokenProvider` from `src/actions/stream.actions`, `getValidatedClientEnv` from `src/lib/env`.
- Produces: `StreamVideoRuntime`, a default-exported client component taking `{ user: { id: string; name: string; image?: string }; children: ReactNode }`. It owns every `@stream-io/video-react-sdk` value import and the SDK stylesheet.

- [ ] **Step 1: Remove the stylesheet from the root layout**

In `src/app/layout.tsx`, delete line 3:

```ts
import "@stream-io/video-react-sdk/dist/css/styles.css";
```

This is why signed-out visitors on the landing page download Stream's stylesheet today.

- [ ] **Step 2: Create the runtime component that owns the SDK**

Create `src/components/providers/StreamVideoRuntime.tsx`:

```tsx
"use client";

import { ReactNode, useEffect, useState } from "react";
import { StreamVideo, StreamVideoClient } from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { streamTokenProvider } from "@/actions/stream.actions";
import { logError } from "@/lib/errors";
import { getValidatedClientEnv } from "@/lib/env";

/**
 * Every value import of the Stream SDK lives here, and nothing imports this
 * module statically — StreamClientProvider pulls it in with next/dynamic. That
 * keeps roughly the whole SDK, and its stylesheet, out of the bundle for routes
 * that never show video (home, practice, calendar, settings, the landing page).
 */
export default function StreamVideoRuntime({
  user,
  children,
}: {
  user: { id: string; name: string; image?: string };
  children: ReactNode;
}) {
  const [client, setClient] = useState<StreamVideoClient>();

  useEffect(() => {
    let didCancel = false;

    try {
      getValidatedClientEnv();
      const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

      if (!apiKey) {
        throw new Error(
          "Missing NEXT_PUBLIC_STREAM_API_KEY. Check your environment configuration.",
        );
      }

      const nextClient = new StreamVideoClient({
        apiKey,
        user: { id: user.id, name: user.name, image: user.image },
        tokenProvider: streamTokenProvider,
      });

      if (!didCancel) setClient(nextClient);

      return () => {
        didCancel = true;
        setClient(undefined);
        nextClient.disconnectUser().catch((error) => {
          logError("StreamVideoRuntime.disconnectUser", error, {
            userId: user.id,
          });
        });
      };
    } catch (error) {
      logError("StreamVideoRuntime.initialize", error, { userId: user.id });
      if (!didCancel) setClient(undefined);
    }
  }, [user.id, user.name, user.image]);

  // Render children regardless of Stream status so a video-service outage does
  // not take down the signed-in shell. Routes that need Stream surface their own
  // loading and error states through the SDK hooks.
  if (!client) return <>{children}</>;

  return <StreamVideo client={client}>{children}</StreamVideo>;
}
```

- [ ] **Step 3: Reduce `StreamClientProvider` to a gate**

Replace `src/components/providers/StreamClientProvider.tsx` entirely:

```tsx
"use client";

import { ReactNode } from "react";
import dynamic from "next/dynamic";
import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";

// Not imported statically: this is the whole point of the split. The SDK chunk
// is fetched only once a route that actually needs video mounts.
const StreamVideoRuntime = dynamic(
  () => import("./StreamVideoRuntime"),
  { ssr: false },
);

const streamRequiredForPath = (pathname: string | null) =>
  !!pathname &&
  (pathname.startsWith("/meeting") ||
    pathname.startsWith("/schedule") ||
    pathname.startsWith("/recordings"));

const StreamClientProvider = ({ children }: { children: ReactNode }) => {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const {
    canScheduleInterviews,
    canViewRecordings,
    isInterviewer,
    isLoading: isRoleLoading,
  } = useUserRole();

  const homeCanStartMeeting =
    pathname === "/" &&
    !isRoleLoading &&
    (isInterviewer || canScheduleInterviews || canViewRecordings);
  const shouldInitializeClient =
    isLoaded && !!user && (streamRequiredForPath(pathname) || homeCanStartMeeting);

  if (!shouldInitializeClient || !user) return <>{children}</>;

  return (
    <StreamVideoRuntime
      user={{
        id: user.id,
        name:
          [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          user.fullName ||
          user.id,
        image: user.imageUrl,
      }}>
      {children}
    </StreamVideoRuntime>
  );
};

export default StreamClientProvider;
```

- [ ] **Step 4: Verify Stream styling still applies where it matters**

Run: `npm run build`
Expected: PASS.

Then start the app and open `/meeting/<any-id>` and `/schedule`. The Stream video controls must still be styled. If they are not, the stylesheet import in `StreamVideoRuntime.tsx` is not reaching the tree and must be moved into `src/app/(root)/meeting/[id]/page.tsx` instead — record which one you used.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/components/providers/StreamVideoRuntime.tsx src/components/providers/StreamClientProvider.tsx
git commit -m "perf(bundle): load the Stream SDK only on routes that use video"
```

---

### Task 6: Cut the wasted work in `getAdminDashboard`

**Scope note — read before starting.** The spec proposed paginating this query with a `by_start_time` index instead of collecting three tables. That does not survive contact with the code: `analytics` (throughput, cancellations, no-shows, funnel, time-to-hire) aggregates over *every* scoped interview, and `candidates` / `interviewerRoster` need the full user list, so slicing to 100 rows would silently change the numbers on the page from all-time to last-100. This task therefore does the two fixes that are pure wins with identical output, and leaves the collects in place. Moving the aggregates onto the existing `dailyMetrics` rollup is the real fix and is deliberately not attempted here.

**Files:**
- Modify: `convex/admin.ts:92-137`

**Interfaces:**
- Consumes: `requirePermission` from `convex/lib/authz.ts`, which already returns `{ identity, user }`.
- Produces: no signature change. `getAdminDashboard` returns exactly the same shape.

- [ ] **Step 1: Remove the duplicated user lookup**

In `convex/admin.ts`, the handler opens with:

```ts
    await requirePermission(ctx, "viewDashboard");
    const { user } = await getCurrentUserRecord(ctx);
```

`requirePermission` already calls `getCurrentUserRecord` internally and returns the record, so this reads the same user row twice on every dashboard load. Replace both lines with:

```ts
    const { user } = await requirePermission(ctx, "viewDashboard");
```

Then remove `getCurrentUserRecord` from the import list at the top of the file **only if** no other function in `convex/admin.ts` still uses it — check with `grep -n "getCurrentUserRecord" convex/admin.ts` before deleting the import.

- [ ] **Step 2: Replace the per-interview feedback scan with a single grouping**

The pipeline map currently runs, once per interview:

```ts
        const interviewFeedback = feedback.filter(
          (entry) => String(entry.interviewId) === String(interview._id),
        );
```

That is O(interviews × feedback). Immediately after the three `.collect()` calls, build the index once:

```ts
    // Grouped once rather than re-filtering the whole feedback array inside the
    // per-interview map below, which was O(interviews × feedback).
    const feedbackByInterviewId = new Map<string, typeof feedback>();
    for (const entry of feedback) {
      const key = String(entry.interviewId);
      const bucket = feedbackByInterviewId.get(key);
      if (bucket) bucket.push(entry);
      else feedbackByInterviewId.set(key, [entry]);
    }
```

and replace the filter inside the map with:

```ts
        const interviewFeedback =
          feedbackByInterviewId.get(String(interview._id)) ?? [];
```

- [ ] **Step 3: Replace the `analytics.feedbackPending` nested scan**

It currently runs `scopedInterviews.some(...)` for every draft feedback entry, also O(n × m). Before the `analytics` object, add:

```ts
    const scopedInterviewIds = new Set(
      scopedInterviews.map((interview) => String(interview._id)),
    );
```

and change the `feedbackPending` line to:

```ts
      feedbackPending: feedback.filter(
        (entry) =>
          entry.state === "draft" &&
          scopedInterviewIds.has(String(entry.interviewId)),
      ).length,
```

- [ ] **Step 4: Verify**

Run: `npm run ci:validate`
Expected: PASS.

Then open `/dashboard` as an admin and confirm the pipeline rows, the funnel counts and the feedback-completion percentages are unchanged from before this task. These are pure refactors — any difference in the numbers is a bug introduced here.

- [ ] **Step 5: Commit**

```bash
git add convex/admin.ts
git commit -m "perf(convex): stop rescanning feedback per interview on the dashboard"
```

---

### Task 7: Measure and record the result

**Files:**
- Modify: `docs/superpowers/specs/2026-08-01-navigation-performance-design.md`

- [ ] **Step 1: Capture the after figures**

Run:

```bash
rm -rf .next && npm run build
du -sh .next/static/chunks
find .next/static/chunks -name "*.js" -type f -printf "%s %p\n" | sort -rn | head -5 | awk '{printf "%.0f KB  %s\n", $1/1024, $2}'
```

Baseline to compare against, recorded before any of this work: **3.7 MB total, largest chunk 467 KB.**

- [ ] **Step 2: Append the result to the spec**

Add a `## Result` section to `docs/superpowers/specs/2026-08-01-navigation-performance-design.md` recording the before and after totals, and state plainly whether the middleware change was verified by hand for both a candidate and an admin. If a number did not move, say so rather than omitting it.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-01-navigation-performance-design.md
git commit -m "docs: record navigation performance results"
```

---

## Self-Review

**Spec coverage:**
- Middleware round-trips → Tasks 1, 2, 3.
- Loading boundaries and `force-dynamic` → Tasks 3 (step 3) and 4.
- Bundle / Stream → Task 5.
- Convex queries → Task 6, **with a documented scope reduction**: the `by_start_time` index and pagination from the spec are not implemented, because `analytics` aggregates over all interviews and pagination would change the displayed numbers. The duplicate-lookup and O(n × m) fixes are done instead.
- Measurement → Task 7.
- Client waterfall → out of scope in the spec, and remains so.

**Placeholder scan:** none. Every code step carries the actual code.

**Type consistency:** `getRequiredRolesForPath` returns `AppRole[] | undefined` in Task 1 and is consumed as that in Task 2. `RoleGuard`'s `allowedRoles` changes from a locally declared `AllowedRole` to the imported `AppRole`; these are structurally identical unions, so the seven existing call sites are unaffected. `StreamVideoRuntime`'s `user` prop shape in Task 5 step 2 matches what `StreamClientProvider` passes in step 3.
