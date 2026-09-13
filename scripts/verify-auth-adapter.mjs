/**
 * Integration check for the Auth.js adapter's Convex functions.
 *
 *   node scripts/verify-auth-adapter.mjs
 *
 * Run from the repository root, against a deployment that has
 * AUTH_ADAPTER_SECRET set (`npx convex env set AUTH_ADAPTER_SECRET ...`) and a
 * matching value in .env.local.
 *
 * This is not a unit test and is deliberately not in `npm test`: it needs a
 * live Convex deployment, and it writes rows. What it covers cannot be checked
 * any other way — in particular that the constant-time secret comparison
 * behaves correctly inside Convex's V8 isolate rather than in Node, and that a
 * verification token really is single-use across two separate round trips.
 *
 * It leaves a test user behind on purpose; deleting rows is not something this
 * script should be able to do.
 */

import fs from "node:fs";

const raw = fs.readFileSync("./.env.local", "utf8");
const re = /^([A-Z_][A-Z0-9_]*)=(?:"([\s\S]*?)"|(.*))$/gm;
let m;
while ((m = re.exec(raw)) !== null) {
  process.env[m[1]] = (m[2] !== undefined ? m[2] : m[3]).trim();
}

const { fetchQuery, fetchMutation } = await import("convex/nextjs");
const { api } = await import("../convex/_generated/api.js");

const SECRET = process.env.AUTH_ADAPTER_SECRET;
const email = `spike-${Date.now()}@example.test`;

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures += 1;
};

// 1. The guard rejects a wrong secret, inside Convex's V8 isolate.
try {
  await fetchQuery(api.authAdapter.getUserByEmail, { secret: "wrong-secret", email });
  check("wrong secret rejected", false);
} catch {
  check("wrong secret rejected", true);
}

// 2. The guard rejects an empty secret.
try {
  await fetchQuery(api.authAdapter.getUserByEmail, { secret: "", email });
  check("empty secret rejected", false);
} catch {
  check("empty secret rejected", true);
}

// 3. The correct secret is accepted.
const missing = await fetchQuery(api.authAdapter.getUserByEmail, { secret: SECRET, email });
check("correct secret accepted, unknown email returns null", missing === null);

// 4. createUser produces a user whose identity fields are filled in.
const created = await fetchMutation(api.authAdapter.createUser, {
  secret: SECRET,
  email,
  name: "Spike User",
});
check("createUser returns an id", typeof created?.id === "string");
check("createUser normalises the email", created?.email === email.toLowerCase());

// 5. The narrow shape holds - no role or permission data leaks to Auth.js.
check(
  "adapter user shape is narrow",
  created !== null &&
    Object.keys(created).sort().join(",") === "email,emailVerified,id,image,name",
);

// 6. createUser is idempotent on email - no duplicate row on a race.
const again = await fetchMutation(api.authAdapter.createUser, {
  secret: SECRET,
  email,
  name: "Spike User Again",
});
check("createUser is idempotent by email", again?.id === created?.id);

// 7. Verification tokens are single use.
const tokenHash = `hash-${Date.now()}`;
await fetchMutation(api.authAdapter.createVerificationToken, {
  secret: SECRET,
  identifier: email,
  tokenHash,
  expires: Date.now() + 60_000,
});
const first = await fetchMutation(api.authAdapter.useVerificationToken, {
  secret: SECRET,
  identifier: email,
  tokenHash,
});
const second = await fetchMutation(api.authAdapter.useVerificationToken, {
  secret: SECRET,
  identifier: email,
  tokenHash,
});
check("verification token redeems once", first !== null);
check("verification token cannot be redeemed twice", second === null);

// 8. An expired token is refused even on first use.
const expiredHash = `expired-${Date.now()}`;
await fetchMutation(api.authAdapter.createVerificationToken, {
  secret: SECRET,
  identifier: email,
  tokenHash: expiredHash,
  expires: Date.now() - 1000,
});
const expired = await fetchMutation(api.authAdapter.useVerificationToken, {
  secret: SECRET,
  identifier: email,
  tokenHash: expiredHash,
});
check("expired token refused", expired === null);

// 9. Credentials round-trip.
await fetchMutation(api.authAdapter.setCredential, {
  secret: SECRET,
  userId: created.id,
  passwordHash: "$argon2id$fake",
});
const cred = await fetchQuery(api.authAdapter.getCredentialByEmail, { secret: SECRET, email });
check("credential round-trips", cred?.passwordHash === "$argon2id$fake");

console.log(failures === 0 ? "\nALL ADAPTER CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
console.log(`(created test user ${created?.id} - remove from the dev deployment if you care)`);
process.exit(failures === 0 ? 0 : 1);
