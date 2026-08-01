import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isOwnerEmail, parseOwnerEmails } from "../../convex/lib/owner.ts";

/**
 * Ownership decides who can grant admin, so the parser failing open would be a
 * privilege escalation rather than a cosmetic bug. These cases are all about the
 * ways an operator can mistype the environment variable.
 */
describe("parseOwnerEmails", () => {
  it("returns nothing for unset, empty or whitespace values", () => {
    assert.deepEqual(parseOwnerEmails(undefined), []);
    assert.deepEqual(parseOwnerEmails(null), []);
    assert.deepEqual(parseOwnerEmails(""), []);
    assert.deepEqual(parseOwnerEmails("   \n  "), []);
  });

  it("accepts comma, semicolon, space and newline separators", () => {
    const expected = ["a@example.com", "b@example.com"];

    assert.deepEqual(parseOwnerEmails("a@example.com,b@example.com"), expected);
    assert.deepEqual(parseOwnerEmails("a@example.com; b@example.com"), expected);
    assert.deepEqual(parseOwnerEmails("a@example.com b@example.com"), expected);
    assert.deepEqual(parseOwnerEmails("a@example.com\nb@example.com"), expected);
  });

  it("normalizes case and surrounding whitespace", () => {
    assert.deepEqual(parseOwnerEmails("  Owner@Example.COM  "), [
      "owner@example.com",
    ]);
  });

  it("deduplicates entries that normalize to the same address", () => {
    assert.deepEqual(
      parseOwnerEmails("owner@example.com, OWNER@example.com"),
      ["owner@example.com"],
    );
  });

  it("drops tokens that are not addresses", () => {
    // A value like "OWNER_EMAILS=owner" must not produce a matchable entry.
    assert.deepEqual(parseOwnerEmails("owner"), []);
    assert.deepEqual(parseOwnerEmails("-, ;"), []);
    assert.deepEqual(parseOwnerEmails("junk, real@example.com"), [
      "real@example.com",
    ]);
  });
});

describe("isOwnerEmail", () => {
  const owners = ["owner@example.com"];

  it("matches regardless of case or padding", () => {
    assert.equal(isOwnerEmail("owner@example.com", owners), true);
    assert.equal(isOwnerEmail("  Owner@Example.com ", owners), true);
  });

  it("rejects non-owners", () => {
    assert.equal(isOwnerEmail("someone@example.com", owners), false);
  });

  it("fails closed when no owner is configured", () => {
    // The critical case: an unset variable must not make everyone an owner.
    assert.equal(isOwnerEmail("anyone@example.com", []), false);
  });

  it("rejects empty or missing addresses", () => {
    assert.equal(isOwnerEmail(undefined, owners), false);
    assert.equal(isOwnerEmail(null, owners), false);
    assert.equal(isOwnerEmail("", owners), false);
  });
});
