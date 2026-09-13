import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getAuthReadiness } from "./readiness.ts";

const complete = {
  NODE_ENV: "production",
  AUTH_URL: "https://commit.example.com",
  AUTH_SECRET: "s",
  AUTH_ADAPTER_SECRET: "s",
  AUTH_JWT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----",
  AUTH_JWT_PUBLIC_KEY: "-----BEGIN PUBLIC KEY-----",
  AUTH_JWT_KID: "k1",
};

const problemsOf = (env: Record<string, string | undefined>) =>
  getAuthReadiness(env).problems.join(" | ");

describe("getAuthReadiness", () => {
  it("is ready when everything required is present", () => {
    assert.deepEqual(getAuthReadiness(complete), { ready: true, problems: [] });
  });

  it("reports every missing variable rather than stopping at the first", () => {
    // An operator setting one variable per deploy is the slowest possible way
    // to fix this, and it is what a first-failure-only report produces.
    const result = getAuthReadiness({ NODE_ENV: "production" });

    assert.equal(result.ready, false);
    for (const name of [
      "AUTH_SECRET",
      "AUTH_ADAPTER_SECRET",
      "AUTH_JWT_PRIVATE_KEY",
      "AUTH_JWT_PUBLIC_KEY",
      "AUTH_JWT_KID",
    ]) {
      assert.match(result.problems.join(" | "), new RegExp(name));
    }
  });

  it("treats whitespace and empty strings as unset", () => {
    assert.match(problemsOf({ ...complete, AUTH_JWT_KID: "   " }), /AUTH_JWT_KID/);
    assert.match(problemsOf({ ...complete, AUTH_SECRET: "" }), /AUTH_SECRET/);
  });

  /**
   * The failure this file exists to have caught, and did not.
   *
   * Production reported auth:true while every Auth.js route returned 500,
   * because AUTH_URL was set to the empty string by a compose default.
   */
  describe("trusted host", () => {
    it("catches AUTH_URL set to the empty string", () => {
      // @auth/core does `trustHost ??= !!(AUTH_URL ?? ...)`. `??` falls through
      // only on null/undefined, so "" stops the chain and yields false. An
      // empty variable is strictly worse than an absent one.
      const result = getAuthReadiness({ ...complete, AUTH_URL: "" });

      assert.equal(result.ready, false);
      assert.match(result.problems.join(" | "), /AUTH_URL is set but empty/);
    });

    it("catches AUTH_URL absent in production", () => {
      const { AUTH_URL: _omitted, ...withoutUrl } = complete;
      const result = getAuthReadiness(withoutUrl);

      assert.equal(result.ready, false);
      assert.match(result.problems.join(" | "), /untrusted host/);
    });

    it("accepts AUTH_TRUST_HOST as an alternative", () => {
      const { AUTH_URL: _omitted, ...withoutUrl } = complete;

      assert.equal(
        getAuthReadiness({ ...withoutUrl, AUTH_TRUST_HOST: "true" }).ready,
        true,
      );
    });

    it("does not complain outside production, matching Auth.js", () => {
      const { AUTH_URL: _omitted, ...withoutUrl } = complete;

      assert.equal(
        getAuthReadiness({ ...withoutUrl, NODE_ENV: "development" }).ready,
        true,
      );
    });
  });

  describe("OAuth providers", () => {
    it("is ready when a provider is absent entirely", () => {
      // Degraded, not broken: credentials and magic-link sign-in still work, so
      // firing here would make the flag mean less when it fires for something
      // that cannot be worked around.
      assert.equal(getAuthReadiness(complete).ready, true);
    });

    it("catches an id with no secret", () => {
      // Fatal rather than degraded: Auth.js throws while building the provider
      // list, which takes down every sign-in method including the ones that
      // need no provider at all.
      const result = getAuthReadiness({ ...complete, AUTH_GOOGLE_ID: "id" });

      assert.equal(result.ready, false);
      assert.match(result.problems.join(" | "), /AUTH_GOOGLE_SECRET is missing/);
    });

    it("catches a secret with no id", () => {
      const result = getAuthReadiness({ ...complete, AUTH_GITHUB_SECRET: "s" });

      assert.equal(result.ready, false);
      assert.match(result.problems.join(" | "), /AUTH_GITHUB_ID is missing/);
    });

    it("is ready when a provider is configured completely", () => {
      assert.equal(
        getAuthReadiness({
          ...complete,
          AUTH_GOOGLE_ID: "id",
          AUTH_GOOGLE_SECRET: "secret",
        }).ready,
        true,
      );
    });
  });

  it("never returns a value, only names and diagnoses", () => {
    const secret = "GOCSPX-a-real-looking-secret";
    const result = getAuthReadiness({
      ...complete,
      AUTH_SECRET: undefined,
      AUTH_GOOGLE_SECRET: secret,
    });

    assert.ok(!JSON.stringify(result).includes(secret));
  });
});
