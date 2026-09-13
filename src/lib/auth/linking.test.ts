import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mayLinkToExistingUser } from "./linking.ts";

/**
 * Account takeover lives here.
 *
 * When someone signs in with Google or GitHub and an account already exists for
 * that email address, we either attach the OAuth identity to it or we refuse.
 * Attaching on an email the provider has not verified means anyone who can
 * register at that provider using a victim's address inherits the victim's
 * Commit account — including its role, so a candidate could arrive as an admin.
 *
 * Every case below must fail closed. This is isolated into its own module with
 * its own tests rather than living inside a sign-in callback precisely because
 * it is the rule most worth being able to read on its own.
 */
describe("mayLinkToExistingUser", () => {
  it("links when the provider verified a matching email", () => {
    assert.equal(
      mayLinkToExistingUser({
        providerEmail: "user@example.com",
        providerEmailVerified: true,
        existingUserEmail: "user@example.com",
      }),
      true,
    );
  });

  it("refuses when the provider has not verified the email", () => {
    assert.equal(
      mayLinkToExistingUser({
        providerEmail: "user@example.com",
        providerEmailVerified: false,
        existingUserEmail: "user@example.com",
      }),
      false,
    );
  });

  it("refuses when the emails differ", () => {
    assert.equal(
      mayLinkToExistingUser({
        providerEmail: "attacker@example.com",
        providerEmailVerified: true,
        existingUserEmail: "user@example.com",
      }),
      false,
    );
  });

  it("refuses when the provider supplied no email at all", () => {
    assert.equal(
      mayLinkToExistingUser({
        providerEmail: null,
        providerEmailVerified: true,
        existingUserEmail: "user@example.com",
      }),
      false,
    );
  });

  it("refuses an empty email rather than treating it as a match", () => {
    assert.equal(
      mayLinkToExistingUser({
        providerEmail: "",
        providerEmailVerified: true,
        existingUserEmail: "",
      }),
      false,
    );
  });

  it("compares case-insensitively and ignores surrounding whitespace", () => {
    assert.equal(
      mayLinkToExistingUser({
        providerEmail: "  User@Example.COM ",
        providerEmailVerified: true,
        existingUserEmail: "user@example.com",
      }),
      true,
    );
  });

  it("does not treat a lookalike address as the same account", () => {
    // Subaddressing is not equivalence: user+x@ is deliverable to user@ on many
    // providers, but they are different strings and must not link.
    assert.equal(
      mayLinkToExistingUser({
        providerEmail: "user+admin@example.com",
        providerEmailVerified: true,
        existingUserEmail: "user@example.com",
      }),
      false,
    );
  });
});
