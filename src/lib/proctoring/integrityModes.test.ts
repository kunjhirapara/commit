import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_INTEGRITY_MODE,
  INTEGRITY_MODES,
  INTEGRITY_MODE_DESCRIPTIONS,
  INTEGRITY_MODE_LABELS,
  isEnforcing,
  isIntegrityMode,
  isMonitored,
  resolveIntegrityMode,
} from "../../../convex/lib/integrityModes.ts";
import { INTEGRITY_DISCLOSURE } from "./disclosure.ts";

/**
 * These assertions look trivial and are not. The mode decides three things that
 * must agree: whether anything is recorded, whether rules are enforced against
 * the candidate, and what the candidate is told before joining. A disagreement
 * between any two of them is silent at runtime — nothing throws, the interview
 * simply behaves differently from the notice the candidate accepted.
 */
describe("resolveIntegrityMode", () => {
  it("defaults to observe when the field is absent", () => {
    // Interviews scheduled before modes existed have no value here, and they
    // must keep the silent monitoring they already have.
    assert.equal(resolveIntegrityMode(undefined), "observe");
    assert.equal(resolveIntegrityMode(null), "observe");
    assert.equal(DEFAULT_INTEGRITY_MODE, "observe");
  });

  it("degrades an unrecognised value to the default rather than throwing", () => {
    // A row written by another deployment must never break joining a call.
    assert.equal(resolveIntegrityMode("strict"), "observe");
    assert.equal(resolveIntegrityMode(42), "observe");
    assert.equal(resolveIntegrityMode({}), "observe");
  });

  it("passes every real mode through unchanged", () => {
    for (const mode of INTEGRITY_MODES) {
      assert.equal(resolveIntegrityMode(mode), mode);
    }
  });
});

describe("isIntegrityMode", () => {
  it("accepts only the declared modes", () => {
    assert.equal(isIntegrityMode("off"), true);
    assert.equal(isIntegrityMode("observe"), true);
    assert.equal(isIntegrityMode("deterrent"), true);
    assert.equal(isIntegrityMode("Deterrent"), false);
    assert.equal(isIntegrityMode(undefined), false);
  });
});

describe("isMonitored", () => {
  it("is false only for off", () => {
    // `off` must write no session row at all, so the report can distinguish
    // "not monitored" from "monitored and found nothing".
    assert.equal(isMonitored("off"), false);
    assert.equal(isMonitored("observe"), true);
    assert.equal(isMonitored("deterrent"), true);
  });
});

describe("isEnforcing", () => {
  it("is true only for deterrent", () => {
    // This is the line between recording and acting on a candidate's screen.
    assert.equal(isEnforcing("off"), false);
    assert.equal(isEnforcing("observe"), false);
    assert.equal(isEnforcing("deterrent"), true);
  });
});

describe("disclosure copy", () => {
  it("covers every monitored mode", () => {
    for (const mode of INTEGRITY_MODES) {
      if (!isMonitored(mode)) continue;
      const copy = INTEGRITY_DISCLOSURE[mode];
      assert.ok(copy, `no disclosure copy for ${mode}`);
      assert.ok(copy.heading.length > 0);
      assert.ok(copy.paragraphs.length > 0);
      assert.ok(copy.acknowledgement.length > 0);
    }
  });

  it("states rules exactly when the mode enforces them", () => {
    // The load-bearing assertion: a mode that enforces must say so, and a mode
    // that does not must not claim it does. Either direction is a lie to the
    // candidate.
    for (const mode of INTEGRITY_MODES) {
      if (!isMonitored(mode)) continue;
      const copy = INTEGRITY_DISCLOSURE[mode];
      assert.equal(
        copy.rules.length > 0,
        isEnforcing(mode),
        `${mode} disclosure rules disagree with whether it enforces`,
      );
      assert.equal(
        copy.fullscreen.required,
        isEnforcing(mode),
        `${mode} fullscreen requirement disagrees with whether it enforces`,
      );
    }
  });

  it("tells the deterrent candidate about masking, paste and the exemption", () => {
    // Named individually because these three are the ones that would otherwise
    // read as a malfunction mid-interview.
    const rules = INTEGRITY_DISCLOSURE.deterrent.rules.join(" ").toLowerCase();
    assert.match(rules, /fullscreen/);
    assert.match(rules, /hidden/);
    assert.match(rules, /past(e|ing)/);
  });
});

describe("mode presentation", () => {
  it("labels and describes every mode for whoever is scheduling", () => {
    for (const mode of INTEGRITY_MODES) {
      assert.ok(INTEGRITY_MODE_LABELS[mode]?.length > 0);
      assert.ok(INTEGRITY_MODE_DESCRIPTIONS[mode]?.length > 0);
    }
  });
});
