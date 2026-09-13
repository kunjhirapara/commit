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
