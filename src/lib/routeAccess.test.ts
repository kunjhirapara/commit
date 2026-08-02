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

  it("exposes the generated metadata routes", () => {
    // The middleware matcher skips static assets by extension and lists neither
    // .txt nor .xml, and /opengraph-image has no extension at all, so all three
    // reach auth.protect() and 307'd to /signin until they were listed here.
    assert.equal(isPublicRoute("/robots.txt"), true);
    assert.equal(isPublicRoute("/sitemap.xml"), true);
    assert.equal(isPublicRoute("/opengraph-image"), true);
  });

  it("exposes the generated icon routes", () => {
    // Next serves the icon file conventions at extensionless paths, so the
    // matcher's extension list cannot skip them either.
    assert.equal(isPublicRoute("/icon"), true);
    assert.equal(isPublicRoute("/apple-icon"), true);
  });

  it("anchors the metadata patterns rather than matching prefixes", () => {
    // Unanchored patterns would hand a signed-out visitor anything living under
    // these names.
    assert.equal(isPublicRoute("/robots.txt/secret"), false);
    assert.equal(isPublicRoute("/sitemap.xml/secret"), false);
    assert.equal(isPublicRoute("/opengraph-image/secret"), false);
    assert.equal(isPublicRoute("/sitemap"), false);
    assert.equal(isPublicRoute("/dashboard/robots.txt"), false);
    assert.equal(isPublicRoute("/icon/secret"), false);
    assert.equal(isPublicRoute("/apple-icon/secret"), false);
  });
});
