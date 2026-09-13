import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  equalizePasswordTiming,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  verifyPassword,
} from "./password.ts";

/**
 * Clerk held these hashes before; now we do. The cases below are the properties
 * that make that safe: that a wrong password never verifies, that two users who
 * pick the same password do not share a hash, and that a corrupt stored value
 * fails closed instead of throwing a 500 that reveals the account exists.
 */
describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    assert.equal(await verifyPassword("wrong horse battery staple", hash), false);
  });

  it("salts, so the same password hashes differently each time", async () => {
    const a = await hashPassword("correct horse battery staple");
    const b = await hashPassword("correct horse battery staple");

    assert.notEqual(a, b);
    // Both must still verify — a salt that broke verification would be worse
    // than no salt.
    assert.equal(await verifyPassword("correct horse battery staple", a), true);
    assert.equal(await verifyPassword("correct horse battery staple", b), true);
  });

  it("uses argon2id rather than a weaker variant", async () => {
    const hash = await hashPassword("correct horse battery staple");

    assert.ok(hash.startsWith("$argon2id$"), `expected argon2id, got ${hash.slice(0, 12)}`);
  });

  it("refuses to hash a password below the minimum length", async () => {
    await assert.rejects(() => hashPassword("a".repeat(MIN_PASSWORD_LENGTH - 1)));
  });

  it("accepts a password at exactly the minimum length", async () => {
    const hash = await hashPassword("a".repeat(MIN_PASSWORD_LENGTH));

    assert.equal(await verifyPassword("a".repeat(MIN_PASSWORD_LENGTH), hash), true);
  });

  it("returns false rather than throwing on a malformed stored hash", async () => {
    assert.equal(await verifyPassword("anything", "not-a-hash"), false);
  });

  it("returns false rather than throwing on an empty stored hash", async () => {
    assert.equal(await verifyPassword("anything", ""), false);
  });
});

/**
 * The sign-in timing oracle.
 *
 * `getCredentialByEmail` returns null for an address with no account, so the
 * "no such user" branch would otherwise return in microseconds while a real
 * account costs a full argon2 verify. That gap is measurable over a network and
 * enumerates users regardless of how carefully the error message is worded.
 */
describe("equalizePasswordTiming", () => {
  it("spends real work rather than returning immediately", async () => {
    const started = process.hrtime.bigint();
    await equalizePasswordTiming("whatever-was-submitted");
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

    // The point is not the exact number. A malformed dummy hash would make
    // verifyPassword catch and return false in well under a millisecond, which
    // silently removes the protection while every other test still passes —
    // this is the only thing that would notice.
    assert.ok(
      elapsedMs > 5,
      `expected a real argon2 verify, took ${elapsedMs.toFixed(2)}ms — is DUMMY_PASSWORD_HASH still a valid argon2 encoding?`,
    );
  });

  it("resolves rather than throwing, whatever it is given", async () => {
    assert.equal(await equalizePasswordTiming(""), undefined);
  });
});
