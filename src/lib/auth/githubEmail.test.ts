import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pickVerifiedGitHubEmail } from "./githubEmail.ts";

/**
 * The cases below are the ones that decide whether GitHub sign-in can take over
 * an existing account. The stock Auth.js provider fails the first two.
 */
describe("pickVerifiedGitHubEmail", () => {
  it("refuses to call an unverified primary address verified", () => {
    const picked = pickVerifiedGitHubEmail(
      [{ email: "victim@example.com", primary: true, verified: false }],
      null,
    );

    assert.equal(picked.verified, false);
  });

  it("does not promote an unverified address just because it is the only one", () => {
    const picked = pickVerifiedGitHubEmail(
      [{ email: "attacker@example.com", primary: true, verified: false }],
      "attacker@example.com",
    );

    assert.deepEqual(picked, { email: "attacker@example.com", verified: false });
  });

  it("skips an unverified primary in favour of a verified address", () => {
    const picked = pickVerifiedGitHubEmail(
      [
        { email: "unverified@example.com", primary: true, verified: false },
        { email: "real@example.com", primary: false, verified: true },
      ],
      null,
    );

    assert.deepEqual(picked, { email: "real@example.com", verified: true });
  });

  it("keeps the address the profile already reported when it is verified", () => {
    const picked = pickVerifiedGitHubEmail(
      [
        { email: "primary@example.com", primary: true, verified: true },
        { email: "public@example.com", primary: false, verified: true },
      ],
      "public@example.com",
    );

    // Preferring the primary here would silently change which address a
    // returning user is known by, and with it which account they match.
    assert.equal(picked.email, "public@example.com");
    assert.equal(picked.verified, true);
  });

  it("matches the profile address regardless of case and surrounding space", () => {
    const picked = pickVerifiedGitHubEmail(
      [{ email: "User@Example.com", primary: false, verified: true }],
      "  user@example.COM  ",
    );

    assert.deepEqual(picked, { email: "User@Example.com", verified: true });
  });

  it("falls back to the primary verified address when the profile one is not verified", () => {
    const picked = pickVerifiedGitHubEmail(
      [
        { email: "primary@example.com", primary: true, verified: true },
        { email: "other@example.com", primary: false, verified: true },
      ],
      "not-in-the-list@example.com",
    );

    assert.deepEqual(picked, { email: "primary@example.com", verified: true });
  });

  it("fails closed on an empty list, which is what a missing scope looks like", () => {
    assert.deepEqual(pickVerifiedGitHubEmail([], "someone@example.com"), {
      email: "someone@example.com",
      verified: false,
    });
  });

  it("fails closed when the API returns something that is not a list", () => {
    // A rate-limit or error body deserialises to an object, not an array. This
    // must not throw, because throwing inside userinfo would surface as a
    // generic OAuth error rather than a refusal to link.
    assert.deepEqual(
      pickVerifiedGitHubEmail(undefined as unknown as never, "someone@example.com"),
      { email: "someone@example.com", verified: false },
    );
  });

  it("ignores entries with no address", () => {
    const picked = pickVerifiedGitHubEmail(
      [
        { email: "", primary: true, verified: true },
        { email: "real@example.com", primary: false, verified: true },
      ],
      null,
    );

    assert.deepEqual(picked, { email: "real@example.com", verified: true });
  });

  it("reports no address at all when there is neither a verified one nor a profile one", () => {
    assert.deepEqual(pickVerifiedGitHubEmail([], null), { email: "", verified: false });
  });
});
