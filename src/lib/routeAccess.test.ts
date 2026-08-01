import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getRequiredRolesForPath, isPublicRoute } from "./routeAccess.ts";

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
