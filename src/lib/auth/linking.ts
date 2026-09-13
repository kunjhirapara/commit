/**
 * Whether an OAuth identity may attach itself to an account that already exists
 * for the same email address.
 *
 * This is the rule that decides account takeover. If we link on an email the
 * provider has not verified, anyone able to register at that provider with a
 * victim's address inherits the victim's Commit account and its role. So the
 * answer is no unless the provider positively asserts the address is theirs.
 *
 * Kept in its own module, deliberately. Buried inside a sign-in callback it
 * would be a condition nobody re-reads; here it has a name and a test file.
 */

const normalize = (email: string) => email.trim().toLowerCase();

export const mayLinkToExistingUser = ({
  providerEmail,
  providerEmailVerified,
  existingUserEmail,
}: {
  providerEmail: string | null | undefined;
  /** The provider's own assertion. Never infer this from the address looking real. */
  providerEmailVerified: boolean;
  existingUserEmail: string;
}): boolean => {
  if (!providerEmail) return false;
  if (!providerEmailVerified) return false;

  const candidate = normalize(providerEmail);
  const existing = normalize(existingUserEmail);

  // An empty string on both sides would otherwise compare equal and link a new
  // OAuth identity to whichever account has no email recorded.
  if (!candidate || !existing) return false;

  // Exact comparison after normalising case and whitespace. Nothing clever:
  // treating user+x@ as user@, or stripping dots for Gmail, would each widen
  // this into a way to match an account the provider never verified.
  return candidate === existing;
};
