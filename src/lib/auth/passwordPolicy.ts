/**
 * The password length floor, in a module with no imports.
 *
 * It lives here rather than in ./password.ts because the sign-up form needs it
 * and that file imports @node-rs/argon2 — a native module. Importing the
 * constant from there would pull argon2 into the browser bundle, which fails
 * the build at best and is a strange thing to ship at worst.
 *
 * ./password.ts re-exports this, so server code can keep importing the whole
 * policy from one place and the two cannot drift.
 */

/**
 * Twelve, because length beats composition rules: a long passphrase is both
 * stronger and easier to remember than a short string with a symbol bolted on.
 *
 * Enforced in `hashPassword` rather than only in the form, so a caller that
 * skips the form cannot store a weak password.
 */
export const MIN_PASSWORD_LENGTH = 12;
