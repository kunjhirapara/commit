import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getAuthReadiness } from "./readiness.ts";

const complete = {
  AUTH_SECRET: "s",
  AUTH_ADAPTER_SECRET: "s",
  AUTH_JWT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----",
  AUTH_JWT_PUBLIC_KEY: "-----BEGIN PUBLIC KEY-----",
  AUTH_JWT_KID: "k1",
};

describe("getAuthReadiness", () => {
  it("is ready when all five are set", () => {
    assert.deepEqual(getAuthReadiness(complete), { ready: true, missing: [] });
  });

  it("reports every missing name rather than stopping at the first", () => {
    // An operator setting one variable per deploy is the slowest possible way
    // to fix this, and it is what a first-failure-only report produces.
    const result = getAuthReadiness({});

    assert.equal(result.ready, false);
    assert.deepEqual(result.missing, [
      "AUTH_SECRET",
      "AUTH_ADAPTER_SECRET",
      "AUTH_JWT_PRIVATE_KEY",
      "AUTH_JWT_PUBLIC_KEY",
      "AUTH_JWT_KID",
    ]);
  });

  it("treats whitespace as unset", () => {
    // An easy thing to paste by accident, and identical to unset for all five.
    const result = getAuthReadiness({ ...complete, AUTH_JWT_KID: "   " });

    assert.equal(result.ready, false);
    assert.deepEqual(result.missing, ["AUTH_JWT_KID"]);
  });

  it("treats an empty string as unset", () => {
    const result = getAuthReadiness({ ...complete, AUTH_SECRET: "" });

    assert.equal(result.ready, false);
    assert.deepEqual(result.missing, ["AUTH_SECRET"]);
  });

  it("does not require the OAuth client IDs", () => {
    // A deployment with no Google app is degraded, not broken: credentials and
    // magic-link sign-in still work. Firing this flag for something a user can
    // work around would make it mean less when it fires for something they
    // cannot.
    assert.equal(getAuthReadiness(complete).ready, true);
  });

  it("never returns a value, only a name", () => {
    const secret = "super-secret-value";
    const result = getAuthReadiness({ ...complete, AUTH_SECRET: undefined, OTHER: secret });

    assert.deepEqual(result.missing, ["AUTH_SECRET"]);
    assert.ok(!JSON.stringify(result).includes(secret));
  });
});
