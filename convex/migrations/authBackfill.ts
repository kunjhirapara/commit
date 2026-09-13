import { v } from "convex/values";

import { internalMutation, internalQuery } from "../_generated/server";

/**
 * Records each user's Clerk identity before Clerk goes away.
 *
 * Two fields, for two different reasons:
 *
 *   `streamUserId` is the load-bearing one. Stream keys calls and recordings by
 *   the user_id it was handed, which has always been the Clerk id, and its copy
 *   of that history cannot be rewritten from here. Once `clerkId` is dropped in
 *   the final task, this is the only remaining record of how Stream knows
 *   someone — and losing it means every migrated user quietly loses access to
 *   their own past recordings. `src/lib/auth/streamIdentity.ts` reads it first
 *   for exactly that reason.
 *
 *   `legacyClerkId` is for support and for the end of the migration: a user who
 *   reports a problem against an old audit-log entry is identified there by
 *   Clerk id, and `convex/lib/subjectResolution.ts` falls back to it once
 *   `clerkId` no longer exists.
 *
 * What this deliberately does NOT do is rewrite `clerkId`. That column is
 * referenced across the database — `interviewerIds`, `candidateId`,
 * `auditLogs.actorClerkId` — and repointing it at the document id would break
 * every one of those references while looking like a tidy-up.
 *
 * Internal rather than public: it rewrites identity columns for every user, so
 * it must not have an endpoint. Run it with the CLI, which carries admin auth:
 *
 *     npx convex run migrations/authBackfill:run
 *
 * Idempotent. A row that already carries both fields is skipped, so a partial
 * failure is repaired by running it again rather than by reasoning about where
 * it stopped.
 */

/** Small enough to stay well inside a mutation's limits on a large table. */
const DEFAULT_BATCH_SIZE = 200;

export const run = internalMutation({
  args: {
    /** From a previous run's `cursor`, to continue when `isDone` was false. */
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("users").paginate({
      cursor: args.cursor ?? null,
      numItems: args.batchSize ?? DEFAULT_BATCH_SIZE,
    });

    let updated = 0;
    let skipped = 0;

    for (const user of page.page) {
      const patch: { legacyClerkId?: string; streamUserId?: string } = {};

      /**
       * Only when `clerkId` is genuinely a Clerk id.
       *
       * convex/authAdapter.ts sets a new user's `clerkId` to their own document
       * id, so for anyone Auth.js created the two are equal and there is no
       * legacy identity to record. Writing one anyway would put a value in
       * `legacyClerkId` that was never a Clerk id — harmless to lookups, and
       * actively misleading to whoever reads the column next.
       */
      if (!user.legacyClerkId && user.clerkId !== user._id) {
        patch.legacyClerkId = user.clerkId;
      }

      /**
       * Always, for everyone.
       *
       * `clerkId` is how Stream knows this user in both cases: the Clerk id for
       * a legacy account, and the document id for one Auth.js created (where
       * Stream has no prior history, so any stable value is correct as long as
       * it is the same one every time).
       */
      if (!user.streamUserId) {
        patch.streamUserId = user.clerkId;
      }

      if (Object.keys(patch).length === 0) {
        skipped += 1;
        continue;
      }

      await ctx.db.patch(user._id, patch);
      updated += 1;
    }

    return {
      processed: page.page.length,
      updated,
      skipped,
      isDone: page.isDone,
      // Pass back as `cursor` to continue. Null when there is nothing left.
      cursor: page.isDone ? null : page.continueCursor,
    };
  },
});

/**
 * How much is left, without changing anything.
 *
 * Exists so "did the backfill finish" is a question with an answer, rather than
 * something inferred from the last run's output — which is easy to lose and
 * easy to misread after a partial run.
 */
export const status = internalQuery({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    const missingStreamUserId = users.filter((user) => !user.streamUserId).length;
    const missingLegacyClerkId = users.filter(
      (user) => !user.legacyClerkId && user.clerkId !== user._id,
    ).length;

    /**
     * The invariant the whole migration rests on.
     *
     * For a migrated account, the id Stream knows them by must be the Clerk id
     * they had. If these ever disagree, the backfill wrote the wrong value and
     * the symptom is not an error — it is a user opening Recordings and finding
     * nothing. Counted here so the check is repeatable rather than a one-off
     * eyeball of a row after the run.
     */
    const streamMismatches = users.filter(
      (user) => user.legacyClerkId && user.streamUserId !== user.legacyClerkId,
    ).length;

    return {
      total: users.length,
      missingStreamUserId,
      missingLegacyClerkId,
      streamMismatches,
      isComplete:
        missingStreamUserId === 0 &&
        missingLegacyClerkId === 0 &&
        streamMismatches === 0,
    };
  },
});
