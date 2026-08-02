/**
 * Facts shared by the privacy policy, the terms, and the recording disclosure.
 *
 * They live here because three documents that disagree about who operates the
 * service, who to contact, or which processors hold the data are worse than one
 * document — a contradiction between published legal pages is the kind of thing
 * that gets noticed exactly when it matters. Editing a fact here changes it
 * everywhere it is stated.
 */

/**
 * The operator is a named individual, not a company. That is deliberate and
 * stated plainly on the pages: users are entitled to know who holds their data,
 * and claiming to be an entity that does not exist would be worse than the
 * modest exposure of saying so.
 */
export const OPERATOR_NAME = "Kunj Hirapara";

/**
 * The published contact for privacy requests, grievances and legal notice.
 *
 * ACTION REQUIRED BEFORE THIS SHIPS: this address must exist and be monitored.
 * The DPDP Rules give a Data Principal the right to a response within 90 days,
 * and a published address that silently bounces is worse than no address at all.
 *
 * A forwarder on the existing domain is used rather than a personal mailbox: the
 * grievance contact is permanently public and tied to a named individual, so it
 * should be something that can be rotated without changing the person's own
 * email address everywhere else.
 */
export const CONTACT_EMAIL = "privacy@kunjdeveloper.me";

/** Bumped whenever the substance of a published document changes. */
export const LEGAL_VERSION = "2026-08-02";

/**
 * Governing law is named; the venue is expressed by reference rather than as a
 * city literal, so the clause cannot go stale if the operator moves and nobody
 * remembers to edit a constant.
 */
export const GOVERNING_LAW = "the laws of India";

/**
 * Minimum age to hold an account.
 *
 * Eighteen is not a rounded-up guess. The DPDP Act 2023 treats everyone under 18
 * as a child, and section 9 prohibits behavioural monitoring of children
 * outright — there is no consent, parental or otherwise, that permits it. Commit
 * monitors candidates during interviews (see convex/schema.ts, proctoringEvents),
 * so admitting a minor would put the product in breach of a rule with no
 * available cure.
 */
export const MINIMUM_AGE = 18;

export type SubProcessor = {
  name: string;
  purpose: string;
  data: string;
};

/**
 * Everyone who processes user data on the operator's behalf.
 *
 * Named individually because "we may share data with service providers" tells a
 * reader nothing, and because Google's OAuth review asks specifically who Google
 * user data reaches.
 */
export const SUB_PROCESSORS: SubProcessor[] = [
  {
    name: "Clerk",
    purpose: "Authentication and account management",
    data: "Name, email address, profile picture, sign-in metadata",
  },
  {
    name: "Convex",
    purpose: "Application database",
    data: "Interviews, comments, feedback, notifications, audit and monitoring records",
  },
  {
    name: "Stream",
    purpose: "Video calls and recording",
    data: "Audio, video, and recordings of interview sessions",
  },
  {
    name: "The configured SMTP provider",
    purpose: "Transactional email",
    data: "Email address and the contents of notification messages",
  },
  {
    name: "The hosting provider for the application server",
    purpose: "Running the application and its database backups",
    data: "All of the above in transit, plus server logs",
  },
];

/**
 * What Commit stores, in the terms the schema actually uses.
 *
 * The DPDP Rules require an itemised description rather than a general one, and
 * writing it from convex/schema.ts rather than from a template is what keeps the
 * published list honest as the product changes.
 */
export type DataCategory = {
  category: string;
  detail: string;
  retention: string;
};

export const DATA_CATEGORIES: DataCategory[] = [
  {
    category: "Account identity",
    detail:
      "Name, email address and profile picture, received from Clerk when you sign up — including when you sign up using Google.",
    retention: "Until you delete your account.",
  },
  {
    category: "Interviews and scheduling",
    detail:
      "Interview times, participants, roles, invitations and calendar entries.",
    retention: "Until deleted by the organiser or with your account.",
  },
  {
    category: "Evaluation records",
    detail:
      "Interviewer comments, structured scorecards and written feedback about a candidate.",
    retention:
      "Retained while the interview record exists, so hiring decisions remain auditable.",
  },
  {
    category: "Video and recordings",
    detail:
      "Audio and video of interview calls, and recordings where the interviewer has enabled them.",
    retention:
      "Held by Stream for the configured window and deleted with the interview.",
  },
  {
    category: "Code you write",
    detail:
      "Source code submitted to the practice sandbox or an interview, and the output of running it.",
    retention: "Stored with the session it belongs to.",
  },
  {
    category: "Interview integrity monitoring",
    detail:
      "For candidates only: how long the interview window lost focus, how much text was pasted at once, whether more than one display was in use, and the difference between your device clock and the server's.",
    // 90 days, because that is what the pre-join notice promises the candidate
    // and what RETENTION_DAYS.proctoringEvents in convex/metrics.ts actually
    // enforces. This line previously read "stored with the interview record",
    // which agreed with neither.
    retention: "Deleted 90 days after the interview.",
  },
  {
    category: "Operational records",
    detail:
      "Audit logs of sensitive actions, notification delivery state, error reports and health metrics.",
    retention: "Kept for security and incident investigation.",
  },
];
