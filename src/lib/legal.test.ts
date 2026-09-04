import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CONTACT_EMAIL,
  DATA_CATEGORIES,
  LEGAL_VERSION,
  MINIMUM_AGE,
  OPERATOR_NAME,
  SUB_PROCESSORS,
} from "./legal.ts";

describe("legal constants", () => {
  it("publishes a parseable ISO version date", () => {
    // Rendered verbatim on three public pages, so a typo here is a typo users
    // and reviewers see.
    assert.match(LEGAL_VERSION, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(Number.isNaN(Date.parse(LEGAL_VERSION)), false);
  });

  it("names an operator and a contact address", () => {
    assert.ok(OPERATOR_NAME.trim().length > 0);
    assert.match(CONTACT_EMAIL, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });

  it("keeps the minimum age at 18", () => {
    // Not a preference. DPDP s.9 bans behavioural monitoring of under-18s with
    // no consent-based exception, and interview integrity monitoring is exactly
    // that. Lowering this silently would put proctoring in breach.
    assert.equal(MINIMUM_AGE, 18);
  });

  it("describes every sub-processor completely", () => {
    assert.ok(SUB_PROCESSORS.length > 0);
    for (const processor of SUB_PROCESSORS) {
      assert.ok(processor.name.trim().length > 0, "sub-processor needs a name");
      assert.ok(
        processor.purpose.trim().length > 0,
        `${processor.name} needs a purpose`,
      );
      assert.ok(
        processor.data.trim().length > 0,
        `${processor.name} needs a data description`,
      );
    }
  });

  it("names Clerk, Convex and Stream, which hold the bulk of user data", () => {
    const names = SUB_PROCESSORS.map((p) => p.name);
    for (const expected of ["Clerk", "Convex", "Stream"]) {
      assert.ok(names.includes(expected), `${expected} must be disclosed`);
    }
  });

  it("gives every data category a retention statement", () => {
    // "We keep data as long as necessary" is the thing this is meant to prevent.
    assert.ok(DATA_CATEGORIES.length > 0);
    for (const category of DATA_CATEGORIES) {
      assert.ok(category.category.trim().length > 0);
      assert.ok(category.detail.trim().length > 0);
      assert.ok(
        category.retention.trim().length > 0,
        `${category.category} needs a retention window`,
      );
    }
  });

  it("discloses the integrity monitoring the app performs", () => {
    // The one disclosure most likely to be dropped by accident, and the one
    // whose absence would matter most.
    const categories = DATA_CATEGORIES.map((c) => c.category).join(" ");
    assert.match(categories, /integrity monitoring/i);
  });
});
