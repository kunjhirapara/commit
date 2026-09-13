import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveStreamUserId } from "./streamIdentity.ts";

/**
 * Getting this wrong does not error. It mints a valid token for a user Stream
 * has never seen, and the migrated user finds their recordings simply gone.
 */
describe("resolveStreamUserId", () => {
  it("prefers streamUserId once the backfill has written it", () => {
    assert.equal(
      resolveStreamUserId({ streamUserId: "user_2abc", clerkId: "k5xyz" }),
      "user_2abc",
    );
  });

  it("uses clerkId before the backfill, when it still holds the Clerk id", () => {
    assert.equal(resolveStreamUserId({ clerkId: "user_2abc" }), "user_2abc");
  });

  it("uses clerkId for an account Auth.js created, where it is the document id", () => {
    // authAdapter sets a new user's clerkId to their own id. Stream has no
    // prior history for them, so any stable value is correct — what matters is
    // that it is the same one every time.
    assert.equal(resolveStreamUserId({ clerkId: "k5new" }), "k5new");
  });

  it("ignores an empty or whitespace streamUserId rather than returning it", () => {
    assert.equal(
      resolveStreamUserId({ streamUserId: "   ", clerkId: "user_2abc" }),
      "user_2abc",
    );
    assert.equal(
      resolveStreamUserId({ streamUserId: "", clerkId: "user_2abc" }),
      "user_2abc",
    );
    assert.equal(
      resolveStreamUserId({ streamUserId: null, clerkId: "user_2abc" }),
      "user_2abc",
    );
  });

  it("returns null rather than inventing an id", () => {
    // An invented id silently creates a second Stream identity for the same
    // person, which is worse than refusing to start the video session.
    assert.equal(resolveStreamUserId({}), null);
    assert.equal(resolveStreamUserId(null), null);
    assert.equal(resolveStreamUserId(undefined), null);
    assert.equal(resolveStreamUserId({ streamUserId: "", clerkId: "" }), null);
  });
});
