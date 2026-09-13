import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";

import {
  CONVEX_TOKEN_TTL_SECONDS,
  mintConvexToken,
  publicJwkFromPem,
  verifyConvexToken,
} from "./convexToken.ts";

const keypair = () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  return { privateKey, publicKey };
};

const ISSUER = "https://commit.kunjdeveloper.com";

/**
 * This token is the only thing standing between a browser session and every
 * Convex function, because Convex authorises on the token alone — it never sees
 * the Auth.js cookie. A token accepted despite being signed by the wrong key,
 * aimed at another issuer, or long expired is a full authorization bypass, so
 * each of those is asserted rather than assumed.
 */
describe("convex token", () => {
  it("round-trips the user id", async () => {
    const { privateKey, publicKey } = keypair();

    const token = await mintConvexToken({
      userId: "user_123",
      privateKeyPem: privateKey,
      kid: "k1",
      issuer: ISSUER,
    });
    const claims = await verifyConvexToken(token, publicKey, ISSUER);

    assert.equal(claims.sub, "user_123");
  });

  it("rejects a token signed by a different key", async () => {
    const signer = keypair();
    const attacker = keypair();

    const token = await mintConvexToken({
      userId: "user_123",
      privateKeyPem: attacker.privateKey,
      kid: "k1",
      issuer: ISSUER,
    });

    await assert.rejects(() => verifyConvexToken(token, signer.publicKey, ISSUER));
  });

  it("rejects a token minted for a different issuer", async () => {
    const { privateKey, publicKey } = keypair();

    const token = await mintConvexToken({
      userId: "user_123",
      privateKeyPem: privateKey,
      kid: "k1",
      issuer: "https://evil.example.com",
    });

    await assert.rejects(() => verifyConvexToken(token, publicKey, ISSUER));
  });

  it("rejects a token that has expired", async () => {
    const { privateKey, publicKey } = keypair();
    const longAgo = Math.floor(Date.now() / 1000) - CONVEX_TOKEN_TTL_SECONDS - 60;

    const token = await mintConvexToken({
      userId: "user_123",
      privateKeyPem: privateKey,
      kid: "k1",
      issuer: ISSUER,
      now: longAgo,
    });

    await assert.rejects(() => verifyConvexToken(token, publicKey, ISSUER));
  });

  it("carries the kid in the token header so the key can be rotated", async () => {
    const { privateKey } = keypair();

    const token = await mintConvexToken({
      userId: "user_123",
      privateKeyPem: privateKey,
      kid: "k1",
      issuer: ISSUER,
    });
    const header = JSON.parse(
      Buffer.from(token.split(".")[0], "base64url").toString("utf8"),
    );

    assert.equal(header.kid, "k1");
    assert.equal(header.alg, "RS256");
  });

  it("publishes a JWK carrying the same kid the token is signed with", async () => {
    const { publicKey } = keypair();

    const jwk = await publicJwkFromPem(publicKey, "k1");

    assert.equal(jwk.kid, "k1");
    assert.equal(jwk.alg, "RS256");
    assert.equal(jwk.use, "sig");
  });

  it("never exposes private key material in the published JWK", async () => {
    const { privateKey, publicKey } = keypair();

    const jwk = await publicJwkFromPem(publicKey, "k1");

    // A JWK exported from a private key would carry "d"; publishing that at a
    // public URL would hand out the signing key itself.
    assert.equal("d" in jwk, false);
    assert.equal(typeof privateKey, "string");
  });
});
