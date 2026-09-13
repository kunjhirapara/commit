import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveUserBySubject } from "../../../convex/lib/subjectResolution.ts";

type Row = { _id: string; clerkId: string; legacyClerkId?: string; email: string };

type Index = "by_clerk_id" | "by_legacy_clerk_id";

/**
 * A stand-in for the Convex ctx, with the three lookups this function uses.
 *
 * `normalizeId` mirrors the real one: it returns the string for something
 * shaped like an id for this table and null for anything else, which is what
 * makes trying `db.get` first safe. `get` records its calls so a test can
 * assert it was never reached with a Clerk id — the real one throws on that.
 */
const makeCtx = (options: {
  byId?: Record<string, Row>;
  byClerkId?: Record<string, Row>;
  byLegacyClerkId?: Record<string, Row>;
  isId?: (value: string) => boolean;
}) => {
  const getCalls: string[] = [];
  const isId = options.isId ?? ((value: string) => value.startsWith("k5"));

  const tables: Record<Index, Record<string, Row> | undefined> = {
    by_clerk_id: options.byClerkId,
    by_legacy_clerk_id: options.byLegacyClerkId,
  };

  return {
    getCalls,
    ctx: {
      db: {
        normalizeId: (_table: "users", id: string) => (isId(id) ? id : null),
        get: async (id: string) => {
          getCalls.push(id);
          return options.byId?.[id] ?? null;
        },
        query: () => ({
          withIndex: (
            index: Index,
            builder: (q: {
              eq: (field: "clerkId" | "legacyClerkId", value: string) => unknown;
            }) => unknown,
          ) => {
            let wanted = "";
            builder({
              eq: (_field, value) => {
                wanted = value;
                return null;
              },
            });
            return { first: async () => tables[index]?.[wanted] ?? null };
          },
        }),
      },
    },
  };
};

/**
 * The ways a signed-in user can arrive while both providers are registered.
 *
 * Case 3 is the one the original by_clerk_id query got wrong. The legacyClerkId
 * case covers the far end of the migration, once Task 16 drops the clerkId
 * column — not the state the backfill leaves, which keeps clerkId intact.
 * Neither symptom is an error: both are a signed-in user being told their
 * account is not ready yet.
 */
describe("resolveUserBySubject", () => {
  it("finds a user Auth.js created, whose clerkId is their own id", async () => {
    const row: Row = { _id: "k5abc", clerkId: "k5abc", email: "new@example.com" };
    const { ctx } = makeCtx({ byId: { k5abc: row }, byClerkId: { k5abc: row } });

    assert.deepEqual(await resolveUserBySubject(ctx, "k5abc"), row);
  });

  it("finds a legacy user presenting a Clerk token, before the backfill", async () => {
    const row: Row = { _id: "k5xyz", clerkId: "user_2abc", email: "old@example.com" };
    const { ctx } = makeCtx({ byClerkId: { user_2abc: row } });

    assert.deepEqual(await resolveUserBySubject(ctx, "user_2abc"), row);
  });

  it("finds a legacy user presenting an Auth.js token", async () => {
    // Subject is the document id while clerkId is still the Clerk one, so only
    // the id lookup finds them. This is the case that appears the moment
    // anyone migrates.
    const row: Row = { _id: "k5xyz", clerkId: "user_2abc", email: "old@example.com" };
    const { ctx } = makeCtx({ byId: { k5xyz: row } });

    assert.deepEqual(await resolveUserBySubject(ctx, "k5xyz"), row);
  });

  it("finds a user whose Clerk id survives only as legacyClerkId", async () => {
    // Not the state the backfill leaves -- it copies clerkId to legacyClerkId
    // without rewriting clerkId, because interviewerIds and auditLogs reference
    // that value. This is the state after Task 16 drops the clerkId column,
    // and covering it means the order of those two steps cannot strand anyone.
    const row: Row = {
      _id: "k5xyz",
      clerkId: "k5xyz",
      legacyClerkId: "user_2abc",
      email: "migrated@example.com",
    };
    const { ctx } = makeCtx({ byLegacyClerkId: { user_2abc: row } });

    assert.deepEqual(await resolveUserBySubject(ctx, "user_2abc"), row);
  });

  it("prefers the current clerkId over a legacy one on collision", async () => {
    // If one row still carries a value as clerkId and another has retired the
    // same value to legacyClerkId, the live column wins. Reversing this would
    // resolve a subject to an account that has already moved on from it.
    const current: Row = { _id: "k5one", clerkId: "user_2abc", email: "current@example.com" };
    const retired: Row = {
      _id: "k5two",
      clerkId: "k5two",
      legacyClerkId: "user_2abc",
      email: "retired@example.com",
    };
    const { ctx } = makeCtx({
      byClerkId: { user_2abc: current },
      byLegacyClerkId: { user_2abc: retired },
    });

    assert.deepEqual(await resolveUserBySubject(ctx, "user_2abc"), current);
  });

  it("never calls db.get with something that is not an id for the table", async () => {
    // The real db.get throws on a malformed id, which would turn a Clerk
    // sign-in into a 500 rather than a lookup.
    const row: Row = { _id: "k5xyz", clerkId: "user_2abc", email: "old@example.com" };
    const { ctx, getCalls } = makeCtx({ byClerkId: { user_2abc: row } });

    await resolveUserBySubject(ctx, "user_2abc");

    assert.deepEqual(getCalls, []);
  });

  it("falls through to the index when the id is well formed but the row is gone", async () => {
    const row: Row = { _id: "k5old", clerkId: "k5gone", email: "recreated@example.com" };
    const { ctx } = makeCtx({ byId: {}, byClerkId: { k5gone: row } });

    assert.deepEqual(await resolveUserBySubject(ctx, "k5gone"), row);
  });

  it("returns null when no lookup matches", async () => {
    const { ctx } = makeCtx({});

    assert.equal(await resolveUserBySubject(ctx, "k5nobody"), null);
  });

  it("refuses an empty subject rather than matching an empty clerkId", async () => {
    const stray: Row = { _id: "k5stray", clerkId: "", email: "stray@example.com" };
    const { ctx, getCalls } = makeCtx({ byClerkId: { "": stray } });

    assert.equal(await resolveUserBySubject(ctx, ""), null);
    assert.deepEqual(getCalls, []);
  });
});
