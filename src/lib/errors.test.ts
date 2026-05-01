import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeErrorMessage } from "./errors.ts";

test("sanitizeErrorMessage extracts the human-readable Convex message", () => {
  const error = new Error(
    "[CONVEX M(interviews:createInterview)] [Request ID: 2dd126428ccef0dd] Server Error Uncaught Error: One or more interviewers already have a conflicting interview in that time window. at createServerError (../../convex/errorUtils.ts:42:8) at assertNoConflicts (../convex/interviews.ts:336:10) at async handler (../convex/interviews.ts:626:33) Called by client",
  );

  assert.equal(
    sanitizeErrorMessage(error),
    "One or more interviewers already have a conflicting interview in that time window.",
  );
});

test("sanitizeErrorMessage keeps plain messages intact", () => {
  assert.equal(
    sanitizeErrorMessage(new Error("Only the host can end this meeting.")),
    "Only the host can end this meeting.",
  );
});
