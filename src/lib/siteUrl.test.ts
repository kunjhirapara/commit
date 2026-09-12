import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { absoluteUrl, normalizeSiteUrl } from "./siteUrl.ts";

/**
 * Every public URL the app emits — sitemap entries, the robots Sitemap
 * directive, canonical and og:url, invitation links in email — is built by
 * concatenating this origin with a path. A trailing slash on the environment
 * variable therefore produced "https://host//terms", which search engines see
 * as a redirect rather than the canonical page. The deploy secret carried
 * exactly that trailing slash in production, so normalising here rather than
 * trusting the secret is the fix that cannot silently regress.
 */
describe("normalizeSiteUrl", () => {
  it("strips a trailing slash", () => {
    assert.equal(
      normalizeSiteUrl("https://commit.kunjdeveloper.com/"),
      "https://commit.kunjdeveloper.com",
    );
  });

  it("strips repeated trailing slashes", () => {
    assert.equal(
      normalizeSiteUrl("https://commit.kunjdeveloper.com///"),
      "https://commit.kunjdeveloper.com",
    );
  });

  it("leaves an already clean origin untouched", () => {
    assert.equal(
      normalizeSiteUrl("https://commit.kunjdeveloper.com"),
      "https://commit.kunjdeveloper.com",
    );
  });

  it("trims whitespace that crept into the environment variable", () => {
    assert.equal(
      normalizeSiteUrl("  https://commit.kunjdeveloper.com/  "),
      "https://commit.kunjdeveloper.com",
    );
  });

  it("falls back to localhost when unset, empty or blank", () => {
    const fallback = "http://localhost:3000";

    assert.equal(normalizeSiteUrl(undefined), fallback);
    assert.equal(normalizeSiteUrl(null), fallback);
    assert.equal(normalizeSiteUrl(""), fallback);
    assert.equal(normalizeSiteUrl("   "), fallback);
  });
});

describe("absoluteUrl", () => {
  const base = "https://commit.kunjdeveloper.com";

  it("joins a path with exactly one slash", () => {
    assert.equal(absoluteUrl("/terms", base), `${base}/terms`);
  });

  it("joins the same way when the base carries a trailing slash", () => {
    assert.equal(absoluteUrl("/terms", `${base}/`), `${base}/terms`);
  });

  it("accepts a path with no leading slash", () => {
    assert.equal(absoluteUrl("terms", base), `${base}/terms`);
  });

  it("renders the site root as a bare trailing slash", () => {
    assert.equal(absoluteUrl("", base), `${base}/`);
  });

  it("preserves a query string", () => {
    assert.equal(
      absoluteUrl("/accept-invitation?token=abc%20def", base),
      `${base}/accept-invitation?token=abc%20def`,
    );
  });
});
