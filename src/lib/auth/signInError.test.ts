import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeSignInError } from "./signInError.ts";

describe("describeSignInError", () => {
  it("returns nothing when there is no error", () => {
    assert.equal(describeSignInError(null), null);
    assert.equal(describeSignInError(undefined), null);
    assert.equal(describeSignInError(""), null);
  });

  it("says a Configuration error is ours and not retryable", () => {
    const result = describeSignInError("Configuration");

    // The case that produced this module: a deployment missing its Auth.js
    // variables bounces every OAuth attempt back here. Telling the user to try
    // again sends them into a loop that cannot succeed.
    assert.equal(result?.retryable, false);
    assert.match(result!.message, /not something you can fix/i);
  });

  it("explains the way forward when linking was refused", () => {
    // AccessDenied is what our own signIn callback produces when it refuses to
    // attach an OAuth identity to an existing account.
    const result = describeSignInError("AccessDenied");

    assert.equal(result?.retryable, false);
    assert.match(result!.message, /sign in the way you did originally|reset your password/i);
  });

  it("treats an expired magic link as retryable", () => {
    const result = describeSignInError("Verification");

    assert.equal(result?.retryable, true);
    assert.match(result!.message, /expired|already been used/i);
  });

  it("falls back for a code it does not know", () => {
    // Auth.js adds codes between versions, and rendering the raw code on a
    // login page is noise to everyone who is not us.
    const result = describeSignInError("OAuthCallbackError");

    assert.equal(result?.retryable, true);
    assert.equal(result?.message, "We could not sign you in. Please try again.");
  });

  it("never echoes the raw code back to the user", () => {
    const result = describeSignInError("SomethingInternal_v5");

    assert.ok(!result!.message.includes("SomethingInternal_v5"));
  });

  it("ignores surrounding whitespace in the code", () => {
    assert.equal(
      describeSignInError("  Configuration  ")?.retryable,
      false,
    );
  });
});
