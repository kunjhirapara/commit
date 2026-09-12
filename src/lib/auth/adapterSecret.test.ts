import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isValidAdapterSecret } from "../../../convex/lib/adapterAuth.ts";

/**
 * The Auth.js adapter reaches Convex through ordinary mutations, because the
 * alternative — internal functions — can only be called from outside Convex
 * with a deploy key, and a deploy key in the app server's runtime would turn a
 * compromised web server into a compromised deployment.
 *
 * That choice means these mutations have a public endpoint, and this comparison
 * is the only thing in front of functions that can create users and link OAuth
 * identities. Every case here is about it failing closed.
 */
describe("isValidAdapterSecret", () => {
  it("accepts the configured secret", () => {
    assert.equal(isValidAdapterSecret("s3cret-value-long", "s3cret-value-long"), true);
  });

  it("rejects a wrong secret of the same length", () => {
    assert.equal(isValidAdapterSecret("s3cret-value-long", "s3cret-value-wr0ng"), false);
  });

  it("rejects a wrong secret of a different length", () => {
    // timingSafeEqual throws on a length mismatch; this must return false
    // rather than propagate, or a probe could distinguish lengths by the
    // difference between a 500 and a clean rejection.
    assert.equal(isValidAdapterSecret("s3cret-value-long", "short"), false);
  });

  it("rejects an empty presented secret", () => {
    assert.equal(isValidAdapterSecret("s3cret-value-long", ""), false);
  });

  it("fails closed when no secret is configured", () => {
    // The dangerous case: an unset environment variable must not mean
    // "anything is allowed". Both an empty and an undefined configured value
    // reject everything, including an empty presented value.
    assert.equal(isValidAdapterSecret(undefined, "anything"), false);
    assert.equal(isValidAdapterSecret("", "anything"), false);
    assert.equal(isValidAdapterSecret(undefined, ""), false);
    assert.equal(isValidAdapterSecret("", ""), false);
  });

  it("rejects a presented secret that merely starts with the real one", () => {
    assert.equal(isValidAdapterSecret("s3cret", "s3cret-plus-extra"), false);
  });
});
