import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getBuildVersion, UNKNOWN_BUILD_VERSION } from "./buildInfo.ts";

describe("getBuildVersion", () => {
  it("truncates a full SHA to twelve characters", () => {
    assert.equal(
      getBuildVersion("af8d2021c3b4e5f60718293a4b5c6d7e8f901234"),
      "af8d2021c3b4",
    );
  });

  it("lowercases, so the workflow can compare without normalising", () => {
    assert.equal(getBuildVersion("AF8D2021C3B4E5F6"), "af8d2021c3b4");
  });

  it("tolerates surrounding whitespace from a build arg", () => {
    assert.equal(getBuildVersion("  af8d2021c3b4e5f6\n"), "af8d2021c3b4");
  });

  it("returns a SHA shorter than the limit unchanged", () => {
    assert.equal(getBuildVersion("af8d202"), "af8d202");
  });

  it("reports unknown when the build arg is absent or empty", () => {
    // A local `docker build` with no --build-arg, and the dev server, both hit
    // this. The rollout check treats it as a mismatch rather than a pass.
    assert.equal(getBuildVersion(undefined), UNKNOWN_BUILD_VERSION);
    assert.equal(getBuildVersion(""), UNKNOWN_BUILD_VERSION);
    assert.equal(getBuildVersion("   "), UNKNOWN_BUILD_VERSION);
  });

  it("rejects a value that is not a git object name", () => {
    // An unexpanded ${{ github.sha }} or a branch name must not be reported as
    // a version: the check would then compare two strings that both look
    // plausible and could agree by accident.
    assert.equal(getBuildVersion("${{ github.sha }}"), UNKNOWN_BUILD_VERSION);
    assert.equal(getBuildVersion("main"), UNKNOWN_BUILD_VERSION);
    assert.equal(getBuildVersion("not-a-sha"), UNKNOWN_BUILD_VERSION);
    // Too short to be one, too.
    assert.equal(getBuildVersion("af8d20"), UNKNOWN_BUILD_VERSION);
  });
});
