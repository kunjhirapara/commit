/**
 * Identity providers Convex will accept tokens from.
 *
 * Both are listed on purpose during the Auth.js migration. Convex uses the
 * first provider whose issuer and applicationID match the presented token, and
 * Clerk's tokens carry Clerk's issuer while ours carry SITE_URL, so the two
 * never collide. Keeping both means a half-migrated deployment authenticates
 * users on either system instead of locking everyone out at the moment the
 * config changes. The Clerk entry is removed in the final task of the migration
 * (see docs/superpowers/plans/2026-09-12-custom-auth.md).
 */

const clerkIssuerUrl = process.env.CLERK_ISSUER_URL;

// Trailing slashes are stripped because `issuer` must match the token's `iss`
// claim exactly, and an operator pasting the URL with one would produce a
// mismatch whose only symptom is that every token is rejected.
const siteUrl = process.env.SITE_URL?.trim().replace(/\/+$/, "");

if (!clerkIssuerUrl && !siteUrl) {
  throw new Error(
    "No auth provider configured. Set SITE_URL (Auth.js) and/or CLERK_ISSUER_URL " +
      "in the Convex environment, for example with " +
      "`npx convex env set SITE_URL https://commit.kunjdeveloper.com`.",
  );
}

const providers = [];

if (siteUrl) {
  providers.push({
    // customJwt rather than OIDC: it needs only a JWKS endpoint, where OIDC
    // would additionally require us to serve /.well-known/openid-configuration.
    type: "customJwt",
    applicationID: "convex",
    issuer: siteUrl,
    jwks: `${siteUrl}/.well-known/jwks.json`,
    algorithm: "RS256",
  });
}

if (clerkIssuerUrl) {
  providers.push({
    domain: clerkIssuerUrl,
    applicationID: "convex",
  });
}

export default { providers };
