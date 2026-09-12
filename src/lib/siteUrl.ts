/**
 * The public origin, and the one way to build an absolute URL from it.
 *
 * `NEXT_PUBLIC_APP_URL` is set per environment, and nothing stops an operator
 * from pasting it with a trailing slash — the production deploy secret had one.
 * Six call sites each did `${process.env.NEXT_PUBLIC_APP_URL ?? fallback}${path}`,
 * so that single stray character reached the live sitemap as
 * `https://commit.kunjdeveloper.com//terms`: a 308 to the real page, which
 * Search Console reports as "Page with redirect" instead of indexing it.
 *
 * Normalising at the boundary fixes every consumer at once and, unlike
 * correcting the secret, cannot regress the next time the value is edited.
 */

const FALLBACK_SITE_URL = "http://localhost:3000";

/** The configured origin with surrounding whitespace and trailing slashes removed. */
export const normalizeSiteUrl = (raw: string | null | undefined): string => {
  const trimmed = raw?.trim();
  if (!trimmed) return FALLBACK_SITE_URL;

  return trimmed.replace(/\/+$/, "");
};

/** The public origin of this deployment, never with a trailing slash. */
export const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_APP_URL);

/**
 * Join a path onto the origin with exactly one slash, whatever either side
 * carries. An empty path yields the bare site root.
 */
export const absoluteUrl = (path: string, base: string = siteUrl): string => {
  const origin = normalizeSiteUrl(base);
  if (!path) return `${origin}/`;

  return `${origin}/${path.replace(/^\/+/, "")}`;
};
