import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildOrganizationSchema, buildSoftwareApplicationSchema } from "./structuredData.ts";

const BASE = "https://commit.kunjdeveloper.com";

/**
 * Structured data is the one part of the page written for machines rather than
 * people, which means nobody notices when it is wrong. A relative URL, an
 * undefined that serialises to null, or a missing @context all parse as valid
 * JSON and are silently discarded by the consumer.
 *
 * Absolute URLs get particular attention here because this codebase has already
 * shipped that bug once: a trailing slash in the deploy secret put
 * https://host//terms into the live sitemap.
 */
describe("buildOrganizationSchema", () => {
  it("declares the schema.org context and type", () => {
    const schema = buildOrganizationSchema(BASE);

    assert.equal(schema["@context"], "https://schema.org");
    assert.equal(schema["@type"], "Organization");
  });

  it("uses absolute URLs", () => {
    const schema = buildOrganizationSchema(BASE);

    assert.equal(schema.url, `${BASE}/`);
    assert.ok(String(schema.logo).startsWith("https://"));
  });

  it("tolerates a base URL with a trailing slash without doubling it", () => {
    const schema = buildOrganizationSchema(`${BASE}/`);

    assert.equal(schema.url, `${BASE}/`);
    assert.equal(String(schema.logo).includes("//icon"), false);
  });
});

describe("buildSoftwareApplicationSchema", () => {
  it("declares the schema.org context and type", () => {
    const schema = buildSoftwareApplicationSchema(BASE);

    assert.equal(schema["@context"], "https://schema.org");
    assert.equal(schema["@type"], "SoftwareApplication");
  });

  it("names an application category, which Google requires", () => {
    const schema = buildSoftwareApplicationSchema(BASE);

    assert.ok(schema.applicationCategory);
  });

  it("uses absolute URLs throughout", () => {
    const schema = buildSoftwareApplicationSchema(`${BASE}/`);

    assert.equal(schema.url, `${BASE}/`);
    assert.equal(String(schema.url).includes("//", 8), false);
  });

  it("serialises without any undefined or null leaking through", () => {
    // JSON.stringify drops undefined keys but keeps nulls, and a null in
    // structured data is treated as a malformed value rather than an absent one.
    const serialised = JSON.stringify(buildSoftwareApplicationSchema(BASE));

    assert.equal(serialised.includes("null"), false);
    assert.equal(serialised.includes("undefined"), false);
  });

  it("produces output that survives a JSON round trip", () => {
    // The schema is embedded in a <script> tag, so anything unserialisable
    // would silently truncate the block rather than fail loudly.
    const schema = buildSoftwareApplicationSchema(BASE);

    assert.deepEqual(JSON.parse(JSON.stringify(schema)), schema);
  });
});
