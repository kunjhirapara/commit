import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { convexAdapter, hashVerificationToken } from "./convexAdapter.ts";

/** Records every backend call so a test can assert on what was sent, not just what came back. */
const fakeBackend = (responses: Record<string, unknown> = {}) => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];

  return {
    calls,
    call: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });

      return name in responses ? responses[name] : null;
    },
  };
};

const SECRET = "adapter-secret";

describe("hashVerificationToken", () => {
  it("is deterministic", () => {
    assert.equal(hashVerificationToken("abc"), hashVerificationToken("abc"));
  });

  it("differs for different tokens", () => {
    assert.notEqual(hashVerificationToken("abc"), hashVerificationToken("abd"));
  });

  it("does not contain the original token", () => {
    assert.equal(hashVerificationToken("supersecret").includes("supersecret"), false);
  });
});

describe("convexAdapter", () => {
  it("creates a user and returns it in Auth.js shape", async () => {
    const backend = fakeBackend({
      createUser: {
        id: "user_1",
        email: "a@example.com",
        name: "A",
        image: null,
        emailVerified: null,
      },
    });
    const adapter = convexAdapter(backend.call, SECRET);

    const user = await adapter.createUser!({
      id: "ignored",
      email: "a@example.com",
      emailVerified: null,
    } as never);

    assert.equal(user.id, "user_1");
    assert.equal(backend.calls[0].name, "createUser");
    assert.equal(backend.calls[0].args.secret, SECRET);
  });

  it("returns null for an unknown email rather than throwing", async () => {
    const backend = fakeBackend();
    const adapter = convexAdapter(backend.call, SECRET);

    assert.equal(await adapter.getUserByEmail!("nobody@example.com"), null);
  });

  it("never sends the plaintext verification token to the backend", async () => {
    const backend = fakeBackend();
    const adapter = convexAdapter(backend.call, SECRET);
    const token = "plaintext-magic-link-token";

    await adapter.createVerificationToken!({
      identifier: "a@example.com",
      token,
      expires: new Date(Date.now() + 60_000),
    });

    const sent = JSON.stringify(backend.calls[0].args);
    // The whole point of storing a hash: a leaked database must not hand the
    // reader working sign-in links.
    assert.equal(sent.includes(token), false);
    assert.equal(backend.calls[0].args.tokenHash, hashVerificationToken(token));
  });

  it("looks up a verification token by its hash, not its plaintext", async () => {
    const backend = fakeBackend({
      useVerificationToken: { identifier: "a@example.com", expires: Date.now() + 60_000 },
    });
    const adapter = convexAdapter(backend.call, SECRET);
    const token = "plaintext-magic-link-token";

    const result = await adapter.useVerificationToken!({
      identifier: "a@example.com",
      token,
    });

    assert.equal(backend.calls[0].args.tokenHash, hashVerificationToken(token));
    assert.equal(JSON.stringify(backend.calls[0].args).includes(token), false);
    // Auth.js expects the token echoed back on success.
    assert.equal(result?.token, token);
  });

  it("returns null when a verification token was already redeemed", async () => {
    const backend = fakeBackend({ useVerificationToken: null });
    const adapter = convexAdapter(backend.call, SECRET);

    const result = await adapter.useVerificationToken!({
      identifier: "a@example.com",
      token: "already-used",
    });

    assert.equal(result, null);
  });

  it("passes the secret on every call it makes", async () => {
    const backend = fakeBackend();
    const adapter = convexAdapter(backend.call, SECRET);

    await adapter.getUserByEmail!("a@example.com");
    await adapter.getUser!("user_1");
    await adapter.getUserByAccount!({ provider: "google", providerAccountId: "g1" });
    await adapter.unlinkAccount!({ provider: "google", providerAccountId: "g1" });

    assert.equal(backend.calls.length, 4);
    for (const madeCall of backend.calls) {
      assert.equal(madeCall.args.secret, SECRET, `${madeCall.name} did not send the secret`);
    }
  });

  it("omits session methods, because the JWT strategy never calls them", () => {
    const adapter = convexAdapter(fakeBackend().call, SECRET);

    // Present-but-broken stubs would fail confusingly at runtime if the session
    // strategy were ever switched; absent methods fail loudly and immediately.
    assert.equal(adapter.createSession, undefined);
    assert.equal(adapter.getSessionAndUser, undefined);
    assert.equal(adapter.updateSession, undefined);
    assert.equal(adapter.deleteSession, undefined);
  });
});
