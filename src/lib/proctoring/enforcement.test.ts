import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { resolveEnforcement } from "./enforcement.ts";
import { INTEGRITY_DISCLOSURE } from "./disclosure.ts";

/**
 * The kill switch is the one place where what a candidate is *told* and what
 * actually *happens* can come apart.
 *
 * `resolveEnforcement` exists to stop that: it collapses the scheduled mode and
 * the flag into a single effective mode, and the disclosure is generated from
 * that rather than from the row. These tests pin the collapse, because the
 * failure is silent — the interview simply behaves differently from the notice
 * the candidate accepted, and nothing throws.
 */
const withFlag = (value: string | undefined) => {
  if (value === undefined) delete process.env.NEXT_PUBLIC_FEATURE_FLAGS;
  else process.env.NEXT_PUBLIC_FEATURE_FLAGS = value;
};

afterEach(() => withFlag(undefined));

describe("resolveEnforcement", () => {
  it("treats a missing mode as observe, monitored but not enforcing", () => {
    const state = resolveEnforcement(undefined);
    assert.equal(state.mode, "observe");
    assert.equal(state.enforcing, false);
    assert.equal(state.monitored, true);
  });

  it("reports off as neither monitored nor enforcing", () => {
    const state = resolveEnforcement("off");
    assert.equal(state.mode, "off");
    assert.equal(state.monitored, false);
    assert.equal(state.enforcing, false);
  });

  it("degrades deterrent to observe while the kill switch is off", () => {
    withFlag(undefined); // integrityDeterrentMode defaults to false
    const state = resolveEnforcement("deterrent");

    // What was scheduled is preserved so the report can still say so...
    assert.equal(state.scheduledMode, "deterrent");
    // ...but nothing is enforced, and the candidate is told the quieter story.
    assert.equal(state.mode, "observe");
    assert.equal(state.enforcing, false);
    assert.equal(state.monitored, true);
  });

  it("enforces deterrent once the kill switch is on", () => {
    withFlag("integrityDeterrentMode=true");
    const state = resolveEnforcement("deterrent");

    assert.equal(state.scheduledMode, "deterrent");
    assert.equal(state.mode, "deterrent");
    assert.equal(state.enforcing, true);
  });

  it("never upgrades a non-deterrent interview when the flag is on", () => {
    // The flag permits enforcement; it must never be the thing that decides an
    // interview should be enforced. That decision belongs to whoever scheduled.
    withFlag("integrityDeterrentMode=true");

    assert.equal(resolveEnforcement("observe").enforcing, false);
    assert.equal(resolveEnforcement("observe").mode, "observe");
    assert.equal(resolveEnforcement("off").monitored, false);
    assert.equal(resolveEnforcement(undefined).enforcing, false);
  });

  it("degrades an unrecognised mode rather than failing the join", () => {
    assert.equal(resolveEnforcement("lockdown").mode, "observe");
    assert.equal(resolveEnforcement("").mode, "observe");
  });
});

describe("the disclosure always matches what will happen", () => {
  /**
   * The load-bearing property of the whole arrangement.
   *
   * Telling a candidate the screen will blur and then never blurring it is the
   * same class of failure as blurring with no warning: in both cases the notice
   * they accepted did not describe their interview.
   */
  const cases = [
    { flag: undefined, scheduled: "deterrent" },
    { flag: "integrityDeterrentMode=true", scheduled: "deterrent" },
    { flag: "integrityDeterrentMode=true", scheduled: "observe" },
    { flag: undefined, scheduled: "observe" },
    { flag: undefined, scheduled: undefined },
  ] as const;

  for (const { flag, scheduled } of cases) {
    it(`holds for scheduled=${scheduled ?? "unset"} flag=${flag ?? "unset"}`, () => {
      withFlag(flag);
      const state = resolveEnforcement(scheduled);
      if (!state.monitored) return;

      const copy = INTEGRITY_DISCLOSURE[state.mode as "observe" | "deterrent"];

      assert.equal(
        copy.rules.length > 0,
        state.enforcing,
        "the disclosure promised rules that will not be enforced, or hid rules that will be",
      );
      assert.equal(
        copy.fullscreen.required,
        state.enforcing,
        "the fullscreen requirement shown does not match what will be required",
      );
    });
  }
});
