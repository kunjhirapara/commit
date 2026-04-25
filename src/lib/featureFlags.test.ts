import test from "node:test";
import assert from "node:assert/strict";
import {
  FEATURE_FLAG_DEFAULTS,
  isServerFeatureEnabled,
  parseFeatureFlags,
} from "./featureFlags.ts";

test("parseFeatureFlags keeps defaults when env is empty", () => {
  assert.deepEqual(parseFeatureFlags(undefined), FEATURE_FLAG_DEFAULTS);
});

test("parseFeatureFlags applies explicit overrides", () => {
  const flags = parseFeatureFlags(
    "telemetryIngestion=false,emailDeliveryApi=true,strictApiRateLimiting=0",
  );

  assert.equal(flags.telemetryIngestion, false);
  assert.equal(flags.emailDeliveryApi, true);
  assert.equal(flags.strictApiRateLimiting, false);
});

test("isServerFeatureEnabled reads flags from env input", () => {
  const env = {
    FEATURE_FLAGS: "telemetryIngestion=false",
    NODE_ENV: "test",
  } as NodeJS.ProcessEnv;

  assert.equal(isServerFeatureEnabled("telemetryIngestion", env), false);
  assert.equal(isServerFeatureEnabled("emailDeliveryApi", env), true);
});
