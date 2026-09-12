import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveEmailMode } from "./mode.ts";

const configured = {
  SMTP_HOST: "smtp-relay.brevo.com",
  SMTP_PORT: "587",
  SMTP_USER: "user",
  SMTP_PASS: "pass",
};

/**
 * The transport used to log-and-report-success whenever SMTP was unconfigured,
 * in every environment. In development that is a convenience. In production it
 * is a silent outage: the app says the mail was sent, nothing arrives, and
 * nothing in the logs distinguishes that from a working system.
 *
 * It matters much more after the Auth.js migration than before it. A dropped
 * interview reminder is an annoyance; a dropped password reset or magic link is
 * a user who cannot get into the product at all, with the app reporting success
 * the whole time.
 */
describe("resolveEmailMode", () => {
  it("sends when SMTP is fully configured", () => {
    assert.equal(resolveEmailMode(configured, "production"), "send");
    assert.equal(resolveEmailMode(configured, "development"), "send");
  });

  it("logs instead of sending in development when SMTP is missing", () => {
    assert.equal(resolveEmailMode({}, "development"), "log");
    assert.equal(resolveEmailMode({}, "test"), "log");
  });

  it("refuses to pretend in production when SMTP is missing", () => {
    // The important case. Reporting success here is what turns a configuration
    // mistake into an invisible one.
    assert.equal(resolveEmailMode({}, "production"), "misconfigured");
  });

  it("treats a partially configured transport as unconfigured", () => {
    // Half-set credentials are a typo, not an intent to send. Production must
    // still refuse rather than attempt an unauthenticated connection.
    const partial = { SMTP_HOST: "smtp-relay.brevo.com", SMTP_PORT: "587" };

    assert.equal(resolveEmailMode(partial, "production"), "misconfigured");
    assert.equal(resolveEmailMode(partial, "development"), "log");
  });

  it("treats blank strings as unset", () => {
    // An env var present but empty is the shape a bad deploy secret takes.
    const blank = { ...configured, SMTP_PASS: "   " };

    assert.equal(resolveEmailMode(blank, "production"), "misconfigured");
  });
});
