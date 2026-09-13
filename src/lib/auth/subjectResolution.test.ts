import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveUserBySubject } from "../../../convex/lib/subjectResolution.ts";

type Row = { _id: string; clerkId: string; email: string };

/**
 * A stand-in for the Convex ctx.
 *
 * `normalizeId` mirrors the real one: it returns the string for something
 * shaped like an id for this table and null for anything else. `get` records
 * its calls so a test can assert it was never reached with a malformed id — the
 * real one throws on that.
 */
const makeCtx = (options: {
  byId?: Record<string, Row>;
  isId?: (value: string) => boolean;
}) => {
  const getCalls: string[] = [];
  const isId = options.isId ?? ((value: string) => value.startsWith("k5"));

  return {
    getCalls,
    ctx: {
      db: {
        normalizeId: (_table: "users", id: string) => (isId(id) ? id : null),
        get: async (id: string) => {
          getCalls.push(id);
          return options.byId?.[id] ?? null;
        },
      },
    },
  };
};

/**
 * With Clerk removed, `identity.subject` is always the Convex document id:
 * Auth.js is the only provider registered in convex/auth.config.ts, and it
 * takes the subject from the id the adapter returned.
 *
 * The `by_clerk_id` and `by_legacy_clerk_id` fallbacks this used to carry went
 * with Clerk. No token in existence carries a Clerk id any more, so those reads
 * could only ever miss.
 */
describe("resolveUserBySubject", () => {
  it("resolves a subject to its user row", async () => {
    const row: Row = { _id: "k5abc", clerkId: "k5abc", email: "user@example.com" };
    const { ctx } = makeCtx({ byId: { k5abc: row } });

    assert.deepEqual(await resolveUserBySubject(ctx, "k5abc"), row);
  });

  it("resolves a migrated user, whose clerkId is not their id", async () => {
    // clerkId still holds the original Clerk value for accounts that predate
    // the migration, because interviewerIds, candidateId and auditLogs all
    // reference it. It is simply not consulted here any more.
    const row: Row = { _id: "k5xyz", clerkId: "user_2abc", email: "old@example.com" };
    const { ctx } = makeCtx({ byId: { k5xyz: row } });

    assert.deepEqual(await resolveUserBySubject(ctx, "k5xyz"), row);
  });

  it("returns null for a well-formed id with no row", async () => {
    const { ctx } = makeCtx({ byId: {} });

    assert.equal(await resolveUserBySubject(ctx, "k5gone"), null);
  });

  it("returns null rather than throwing on a malformed subject", async () => {
    // The real db.get throws on anything that is not an id for this table. A
    // malformed subject must become "no such user", which the caller turns into
    // a sign-in prompt, rather than a 500 and an error page.
    const { ctx, getCalls } = makeCtx({});

    assert.equal(await resolveUserBySubject(ctx, "user_2abc"), null);
    assert.deepEqual(getCalls, []);
  });

  it("refuses an empty subject without touching the database", async () => {
    const { ctx, getCalls } = makeCtx({});

    assert.equal(await resolveUserBySubject(ctx, ""), null);
    assert.deepEqual(getCalls, []);
  });
});
