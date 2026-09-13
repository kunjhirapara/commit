import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing.
 *
 * Node runtime only. Never import this from `src/auth.config.ts` or anything
 * else the Edge middleware loads — argon2 is a native module and the Edge
 * bundle will fail to build. That constraint is the whole reason the Auth.js
 * config is split across two files.
 */

/**
 * Twelve, because length beats composition rules: a long passphrase is both
 * stronger and easier to remember than a short string with a symbol bolted on.
 * Enforced in `hashPassword` rather than only in the form, so a caller that
 * skips the form cannot store a weak password.
 */
export const MIN_PASSWORD_LENGTH = 12;

export const hashPassword = async (plain: string): Promise<string> => {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  // Defaults are argon2id with a salt per hash, which is what we want; pinning
  // the cost parameters here would freeze them at today's hardware.
  return hash(plain);
};

/**
 * Returns false rather than throwing when the stored value is unusable.
 *
 * A throw would surface as a 500 while a genuinely wrong password returns a
 * clean failure, and that difference is observable — it tells an attacker which
 * addresses have accounts with corrupt rows. Failing closed and quietly keeps
 * every rejection indistinguishable.
 */
export const verifyPassword = async (plain: string, stored: string): Promise<boolean> => {
  try {
    return await verify(stored, plain);
  } catch {
    return false;
  }
};

/**
 * A real argon2id hash, used to spend the same time verifying a password for an
 * address that has no account as for one that does.
 *
 * Without it, credentials sign-in is a user-enumeration oracle regardless of how
 * carefully the error message is worded: a missing row returns in under a
 * millisecond while a present one costs a full argon2 verify, and that gap is
 * trivially measurable over the network. The generic "invalid email or
 * password" only hides the difference from someone reading the response body.
 *
 * The plaintext behind this hash is unreachable — it is longer than any form
 * accepts and was generated once, then discarded — but that is not what makes
 * it safe. `equalizePasswordTiming` throws the result away, so even a caller
 * that somehow guessed the input gains nothing.
 */
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$R41WOqJH1CXqrdDBxds5+g$G4BrsJGBngkUzSb7zHFvaDrsj7pLhvIHw34rvMhZM6U";

/**
 * Burns one argon2 verify and returns nothing.
 *
 * Call this on the "no such user" branch of sign-in, before returning the same
 * generic failure the wrong-password branch returns.
 */
export const equalizePasswordTiming = async (plain: string): Promise<void> => {
  await verifyPassword(plain, DUMMY_PASSWORD_HASH);
};
