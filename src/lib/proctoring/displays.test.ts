import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isLikelyOffPrimaryDisplay,
  resolveDisplaySupport,
} from "./displays.ts";

/**
 * The three-state exists so that "the browser cannot tell us" never renders as
 * "we checked and it was fine". Firefox and Safari return undefined here, and
 * collapsing that to false would make a candidate with three monitors look
 * identical to an honest one with a laptop.
 */
describe("resolveDisplaySupport", () => {
  it("reports extended when the browser says so", () => {
    assert.equal(resolveDisplaySupport({ isExtended: true }), "extended");
  });

  it("reports single when the browser says so", () => {
    assert.equal(resolveDisplaySupport({ isExtended: false }), "single");
  });

  it("reports unsupported when the property is missing", () => {
    assert.equal(resolveDisplaySupport({}), "unsupported");
    assert.equal(resolveDisplaySupport(undefined), "unsupported");
  });

  it("reports unsupported for a non-boolean value rather than coercing it", () => {
    // A Permissions-Policy block, or a polyfill, must not be read as "single".
    assert.equal(
      resolveDisplaySupport({ isExtended: null as unknown as boolean }),
      "unsupported",
    );
  });
});

describe("isLikelyOffPrimaryDisplay", () => {
  const primary = { availWidth: 1920, availHeight: 1080 };

  it("is false for a window sitting inside the primary display", () => {
    assert.equal(
      isLikelyOffPrimaryDisplay({
        screenX: 100,
        screenY: 80,
        outerWidth: 1200,
        outerHeight: 800,
        ...primary,
      }),
      false,
    );
  });

  it("is true for a window positioned to the right of the primary display", () => {
    assert.equal(
      isLikelyOffPrimaryDisplay({
        screenX: 1920,
        screenY: 0,
        outerWidth: 1200,
        outerHeight: 800,
        ...primary,
      }),
      true,
    );
  });

  it("is true for a window at a negative offset, i.e. a display to the left", () => {
    assert.equal(
      isLikelyOffPrimaryDisplay({
        screenX: -1200,
        screenY: 0,
        outerWidth: 1200,
        outerHeight: 800,
        ...primary,
      }),
      true,
    );
  });

  it("tolerates a window overhanging the edge by a small margin", () => {
    // Windows commonly sit a few pixels off-screen; treating that as a second
    // monitor would flag most sessions.
    assert.equal(
      isLikelyOffPrimaryDisplay({
        screenX: 1800,
        screenY: 0,
        outerWidth: 200,
        outerHeight: 800,
        ...primary,
      }),
      false,
    );
  });

  it("is false when geometry is unavailable rather than guessing", () => {
    assert.equal(isLikelyOffPrimaryDisplay(undefined), false);
  });
});
