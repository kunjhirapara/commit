/**
 * Whether this process may send email, and what to do when it may not.
 *
 * Split out of transport.ts so the decision can be tested without constructing
 * a nodemailer transport, and so the production-vs-development difference is
 * stated in one readable place rather than inferred from a fallback branch.
 */

export type EmailMode =
  /** SMTP is configured; send for real. */
  | "send"
  /** Development convenience: log the message and carry on. */
  | "log"
  /** Production with no usable SMTP configuration. Refuse, loudly. */
  | "misconfigured";

/**
 * An index signature rather than four optional keys, so `process.env` itself
 * can be passed. TypeScript refuses to assign ProcessEnv to an all-optional
 * object type — they share no declared properties — and the alternative was a
 * cast at the one call site that matters most.
 */
type SmtpEnv = Record<string, string | undefined>;

const present = (value: string | undefined) => Boolean(value && value.trim());

export const resolveEmailMode = (env: SmtpEnv, nodeEnv: string | undefined): EmailMode => {
  const configured =
    present(env.SMTP_HOST) &&
    present(env.SMTP_PORT) &&
    present(env.SMTP_USER) &&
    present(env.SMTP_PASS);

  if (configured) return "send";

  // Partial configuration is a typo, not an intention — it falls in here too,
  // rather than being attempted as an unauthenticated connection.
  return nodeEnv === "production" ? "misconfigured" : "log";
};
