/**
 * Identity providers Convex will accept tokens from.
 *
 * One provider now. Clerk's entry was removed with the rest of Clerk, so a
 * token from it is no longer accepted by this deployment — which is the point
 * of removing it rather than leaving it configured and unused.
 *
 * `SITE_URL` is required, and Convex enforces that statically: any environment
 * variable named in this file must be set on the deployment or `convex deploy`
 * fails, whether or not the code path that reads it runs. Set it with
 * `npx convex env set SITE_URL https://commit.kunjdeveloper.com`.
 */

// Trailing slashes are stripped because `issuer` must match the token's `iss`
// claim exactly, and an operator pasting the URL with one would produce a
// mismatch whose only symptom is that every token is rejected — which surfaces
// as "you must be signed in" shown to people who are.
const siteUrl = process.env.SITE_URL?.trim().replace(/\/+$/, "");

if (!siteUrl) {
  throw new Error(
    "SITE_URL is not set on this Convex deployment, so no auth provider is " +
      "configured and every request would be unauthenticated. Set it with " +
      "`npx convex env set SITE_URL https://commit.kunjdeveloper.com`.",
  );
}

export default {
  providers: [
    {
      // customJwt rather than OIDC: it needs only a JWKS endpoint, where OIDC
      // would additionally require us to serve /.well-known/openid-configuration.
      type: "customJwt",
      applicationID: "convex",
      issuer: siteUrl,
      jwks: `${siteUrl}/.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
};
