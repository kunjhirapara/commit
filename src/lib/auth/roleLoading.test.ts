import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isRoleStateLoading } from "./roleLoading.ts";

/**
 * Regression cover for "refreshing a guarded page bounces you home".
 *
 * RoleGuard treats "not loading and no role" as denied and redirects. So any
 * moment where this predicate says "settled" while the role is still unknown is
 * a redirect the user did not ask for — which is exactly what happened on
 * refresh, because Clerk reports `user: undefined` until it has loaded.
 */
const settled = {
  isSessionLoaded: true,
  hasUser: true,
  isConvexAuthLoading: false,
  isQueryingCurrentUser: true,
  hasUserData: true,
};

describe("isRoleStateLoading", () => {
  it("is loading before the session has resolved, even though there is no user yet", () => {
    // The bug: `undefined` user was read as "signed out and settled" rather than
    // "we do not know yet", so a refresh looked identical to a denial.
    assert.equal(
      isRoleStateLoading({ ...settled, isSessionLoaded: false, hasUser: false }),
      true,
    );
  });

  it("is loading while Convex auth is still resolving", () => {
    assert.equal(
      isRoleStateLoading({ ...settled, isConvexAuthLoading: true }),
      true,
    );
  });

  it("is loading while the current-user query is in flight", () => {
    assert.equal(isRoleStateLoading({ ...settled, hasUserData: false }), true);
  });

  it("is settled once the session, Convex and the query have all resolved", () => {
    assert.equal(isRoleStateLoading(settled), false);
  });

  it("is settled for a genuinely signed-out visitor once the session has loaded", () => {
    // Middleware redirects these to sign-in before a guard sees them, but the
    // predicate must still terminate rather than hang on a spinner.
    assert.equal(
      isRoleStateLoading({
        isSessionLoaded: true,
        hasUser: false,
        isConvexAuthLoading: false,
        isQueryingCurrentUser: false,
        hasUserData: false,
      }),
      false,
    );
  });

  it("does not wait on the query when it was never started", () => {
    assert.equal(
      isRoleStateLoading({
        ...settled,
        isQueryingCurrentUser: false,
        hasUserData: false,
      }),
      false,
    );
  });
});
