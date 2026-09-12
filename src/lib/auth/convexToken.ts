import { SignJWT, exportJWK, importPKCS8, importSPKI, jwtVerify } from "jose";

/**
 * The seam between Auth.js and Convex.
 *
 * Convex never sees the Auth.js session cookie. It authorises purely on a JWT
 * that it verifies itself against the JWKS we publish, so this module is the
 * single place where "the browser has a valid session" becomes "Convex will run
 * this function". Everything security-relevant about that translation lives
 * here rather than being spread across the routes that call it.
 */

/**
 * Ten minutes.
 *
 * Signing out only clears the Auth.js cookie — a Convex token already in the
 * client's hands keeps working until it expires, because there is nothing to
 * revoke it against. The TTL *is* the revocation window, which is why it is
 * short rather than the hour or day that would be more convenient.
 */
export const CONVEX_TOKEN_TTL_SECONDS = 600;

/** Must match `applicationID` in convex/auth.config.ts, which Convex checks against `aud`. */
const AUDIENCE = "convex";

const ALG = "RS256";

export const mintConvexToken = async ({
  userId,
  privateKeyPem,
  kid,
  issuer,
  now = Math.floor(Date.now() / 1000),
}: {
  userId: string;
  privateKeyPem: string;
  kid: string;
  issuer: string;
  /** Injectable so expiry can be tested without waiting ten minutes. */
  now?: number;
}): Promise<string> => {
  const key = await importPKCS8(privateKeyPem, ALG);

  return new SignJWT({})
    .setProtectedHeader({ alg: ALG, kid })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + CONVEX_TOKEN_TTL_SECONDS)
    .sign(key);
};

/**
 * Verification is Convex's job in production; this exists so the contract is
 * testable and so the token route can assert what it just minted is valid.
 *
 * `issuer` and `audience` are passed explicitly rather than left to default:
 * jwtVerify only checks claims it is told to check, and a token accepted
 * without them would be a token any issuer could mint.
 */
export const verifyConvexToken = async (
  token: string,
  publicKeyPem: string,
  issuer: string,
): Promise<{ sub: string }> => {
  const key = await importSPKI(publicKeyPem, ALG);
  const { payload } = await jwtVerify(token, key, {
    issuer,
    audience: AUDIENCE,
    algorithms: [ALG],
  });

  if (!payload.sub) {
    throw new Error("Convex token has no subject");
  }

  return { sub: payload.sub };
};

/**
 * The public half, shaped for /.well-known/jwks.json.
 *
 * Takes the public PEM specifically so that a private key cannot be published
 * by mistake — importSPKI rejects a private key outright rather than quietly
 * exporting one with its secret component intact.
 */
export const publicJwkFromPem = async (publicKeyPem: string, kid: string) => {
  const key = await importSPKI(publicKeyPem, ALG);
  const jwk = await exportJWK(key);

  return { ...jwk, kid, alg: ALG, use: "sig" };
};
