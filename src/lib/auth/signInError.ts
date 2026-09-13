/**
 * Turns an Auth.js error code into something a person can act on.
 *
 * `pages.error` points at /signin, so a failed sign-in arrives back here as
 * `?error=<code>` and nothing else. Without this the page renders as though
 * nothing happened — the user clicks "Continue with Google", is bounced through
 * the provider, and lands on an identical sign-in form with no explanation.
 * That is indistinguishable from the button being broken.
 *
 * The codes are Auth.js's own. Two matter more than the rest here:
 *
 *   `Configuration` means the server is misconfigured — a missing client secret,
 *   a missing AUTH_SECRET. It is nobody's fault but ours, and saying "try again"
 *   would send someone into a loop that cannot succeed.
 *
 *   `AccessDenied` is what our own signIn callback produces when it refuses to
 *   link an OAuth identity to an existing account (see mayLinkToExistingUser).
 *   That refusal is deliberate and the message has to explain the way forward
 *   rather than read as a generic failure.
 */

export type SignInErrorMessage = {
  /** Shown to the user. */
  message: string;
  /**
   * Whether retrying could plausibly work.
   *
   * False for server misconfiguration, where a retry button is an invitation to
   * click it repeatedly and get the same result.
   */
  retryable: boolean;
};

const MESSAGES: Record<string, SignInErrorMessage> = {
  Configuration: {
    message:
      "Sign-in is not configured correctly on our side. This is not something you can fix — please try again later or contact support.",
    retryable: false,
  },
  AccessDenied: {
    message:
      "We could not use that account to sign you in. If you already have a Commit account with this email address, sign in the way you did originally, or reset your password.",
    retryable: false,
  },
  Verification: {
    message:
      "That sign-in link has expired or has already been used. Request a new one.",
    retryable: true,
  },
  OAuthAccountNotLinked: {
    message:
      "An account already exists for this email address using a different sign-in method. Use that method, or reset your password to add one.",
    retryable: false,
  },
  EmailSignin: {
    message: "We could not send the sign-in link. Please try again.",
    retryable: true,
  },
  CredentialsSignin: {
    message: "That email and password do not match an account.",
    retryable: true,
  },
  SessionRequired: {
    message: "Please sign in to continue.",
    retryable: true,
  },
};

const FALLBACK: SignInErrorMessage = {
  message: "We could not sign you in. Please try again.",
  retryable: true,
};

export const describeSignInError = (
  code: string | null | undefined,
): SignInErrorMessage | null => {
  if (!code) return null;

  // Unknown codes fall back rather than rendering the raw code. Auth.js adds
  // new ones between versions, and "OAuthCallbackError" on a login page is
  // noise to everyone who is not us.
  return MESSAGES[code.trim()] ?? FALLBACK;
};
