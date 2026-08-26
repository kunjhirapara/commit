import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const userRole = v.union(
  v.literal("candidate"),
  v.literal("interviewer"),
  v.literal("recruiter"),
  v.literal("developer"),
  v.literal("admin"),
);

const privilegedInvitationRole = v.union(
  v.literal("interviewer"),
  v.literal("recruiter"),
  v.literal("developer"),
  v.literal("admin"),
);

const interviewStatus = v.union(
  v.literal("draft"),
  v.literal("scheduled"),
  v.literal("live"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("no_show"),
  v.literal("rescheduled"),
  v.literal("passed"),
  v.literal("rejected"),
  v.literal("upcoming"),
  v.literal("succeeded"),
  v.literal("failed"),
);

const notificationStatus = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("sent"),
  v.literal("read"),
  v.literal("failed"),
  v.literal("suppressed"),
);
const notificationChannel = v.union(v.literal("in_app"), v.literal("email"));
const notificationCategory = v.union(
  v.literal("interview_schedule"),
  v.literal("interview_update"),
  v.literal("interview_reminder"),
  v.literal("feedback_reminder"),
  v.literal("system"),
);

const feedbackState = v.union(v.literal("draft"), v.literal("submitted"));
const feedbackVisibility = v.union(v.literal("shared"), v.literal("private"));
const decisionOutcome = v.union(
  v.literal("pass"),
  v.literal("reject"),
  v.literal("hold"),
  v.literal("review"),
);
const observabilityLevel = v.union(
  v.literal("info"),
  v.literal("warn"),
  v.literal("error"),
  v.literal("critical"),
);
const healthStatus = v.union(
  v.literal("healthy"),
  v.literal("degraded"),
  v.literal("unhealthy"),
);
const backgroundJobStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("dead_letter"),
  v.literal("cancelled"),
);
const backgroundJobKind = v.union(
  v.literal("interview_reminder"),
  v.literal("interview_cleanup"),
  v.literal("interview_reconcile"),
  v.literal("webhook_retry"),
  v.literal("delayed_processing"),
);
const recoveryOperationStatus = v.union(
  v.literal("open"),
  v.literal("resolved"),
);
const recoveryOperationMode = v.union(
  v.literal("automatic"),
  v.literal("manual"),
);
const backupSnapshotStatus = v.union(
  v.literal("available"),
  v.literal("restored"),
  v.literal("failed"),
);
const backupSnapshotKind = v.union(
  v.literal("automatic"),
  v.literal("manual"),
  v.literal("restore_drill"),
);

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    image: v.optional(v.string()),
    role: userRole,
    customRoleId: v.optional(v.id("roleDefinitions")),
    clerkId: v.string(),
    skills: v.optional(v.array(v.string())),
    availabilitySummary: v.optional(v.string()),
    permissionTags: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
    // Optional so existing rows are treated as not-yet-onboarded rather than
    // needing a backfill; the welcome dialog is harmless to show once.
    hasCompletedOnboarding: v.optional(v.boolean()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    // Dashboards need "every interviewer" and "every candidate". Without this
    // they collected the whole table and filtered in JS, which is fine at ten
    // users and not fine once public signup fills the table with candidates.
    .index("by_role", ["role"])
    // The team page picked a candidate from a <Select> listing every candidate
    // in the database. That is both an unbounded read and an unusable control
    // once there are more than a screenful, so the picker searches instead.
    .searchIndex("search_by_name", {
      searchField: "name",
      filterFields: ["role"],
    }),

  roleDefinitions: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
    createdBy: v.string(),
    updatedBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  interviews: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    templateId: v.optional(v.string()),
    templateLabel: v.optional(v.string()),
    startTime: v.number(),
    scheduledStartTime: v.optional(v.number()),
    scheduledEndTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
    timezone: v.optional(v.string()),
    status: interviewStatus,
    streamCallId: v.string(),
    candidateId: v.string(),
    interviewerIds: v.array(v.string()),
    meetingInstructions: v.optional(v.string()),
    brandName: v.optional(v.string()),
    browserFallbackInstructions: v.optional(v.string()),
    bufferBeforeMinutes: v.optional(v.number()),
    bufferAfterMinutes: v.optional(v.number()),
    cancellationReason: v.optional(v.string()),
    rescheduleReason: v.optional(v.string()),
    reminderSentAt: v.optional(v.number()),
    feedbackReminderSentAt: v.optional(v.number()),
    /**
     * How this interview is monitored: "off" | "observe" | "deterrent".
     *
     * Absent means `observe`, so interviews scheduled before integrity modes
     * existed keep the silent monitoring they already have and nothing needs
     * migrating. Resolved through `resolveIntegrityMode` in
     * convex/lib/integrityModes.ts rather than read raw, so an unrecognised
     * value degrades to the default instead of breaking a join.
     */
    integrityMode: v.optional(v.string()),
    recordingDisclosure: v.optional(v.string()),
    recordingRetentionDays: v.optional(v.number()),
    notesRetentionDays: v.optional(v.number()),
    candidateDataRetentionDays: v.optional(v.number()),
    lifecycleEvents: v.optional(
      v.array(
        v.object({
          type: v.string(),
          at: v.number(),
          actorClerkId: v.optional(v.string()),
          note: v.optional(v.string()),
        }),
      ),
    ),
  })
    .index("by_candidate_id", ["candidateId"])
    .index("by_stream_call_id", ["streamCallId"])
    .index("by_status", ["status"])
    .index("by_startTime", ["startTime"]),

  customCalendarEvents: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    userClerkId: v.string(),
    createdBy: v.string(),
    updatedAt: v.number(),
  })
    .index("by_user_clerk_id", ["userClerkId"])
    .index("by_user_clerk_id_start_time", ["userClerkId", "startTime"]),

  comments: defineTable({
    content: v.string(),
    rating: v.number(),
    interviewerId: v.string(),
    interviewId: v.id("interviews"),
    visibility: v.optional(feedbackVisibility),
    updatedAt: v.optional(v.number()),
  })
    .index("by_interview_id", ["interviewId"])
    .index("by_interview_id_interviewer_id", ["interviewId", "interviewerId"]),

  feedback: defineTable({
    interviewId: v.id("interviews"),
    interviewerId: v.string(),
    state: feedbackState,
    visibility: feedbackVisibility,
    roundType: v.optional(v.string()),
    recommendation: decisionOutcome,
    summary: v.string(),
    sharedNotes: v.optional(v.string()),
    privateNotes: v.optional(v.string()),
    decisionSummary: v.optional(v.string()),
    weightedScore: v.number(),
    overallScore: v.number(),
    hideUntilSubmit: v.boolean(),
    competencies: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        score: v.number(),
        weight: v.number(),
        notes: v.optional(v.string()),
      }),
    ),
    dueAt: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
    updatedAt: v.number(),
    editedAt: v.optional(v.number()),
  })
    .index("by_interview_id", ["interviewId"])
    .index("by_interview_id_interviewer_id", ["interviewId", "interviewerId"])
    .index("by_interviewer_id_state", ["interviewerId", "state"]),

  interviewSessionEvents: defineTable({
    interviewId: v.id("interviews"),
    streamCallId: v.string(),
    type: v.string(),
    actorClerkId: v.optional(v.string()),
    actorRole: v.optional(userRole),
    detail: v.optional(v.string()),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_interview_id", ["interviewId"])
    .index("by_stream_call_id", ["streamCallId"])
    // Needed by the daily metrics rollup and the retention pruner, which both
    // scan by time rather than by interview.
    .index("by_created_at", ["createdAt"]),

  /**
   * Interview integrity signals, one row per recorded event.
   *
   * Deliberately not folded into `interviewSessionEvents`. That table backs
   * `getSessionEvents`, which does `.take(50)` — proctoring is a far
   * higher-volume stream and would swamp the existing session timeline. The two
   * also want different retention.
   *
   * Append-only: there is no update or delete path for a candidate, and the
   * server timestamps every row itself.
   */
  proctoringEvents: defineTable({
    interviewId: v.id("interviews"),
    streamCallId: v.string(),
    /** Always the candidate. Interviewers are not monitored. */
    candidateClerkId: v.string(),
    kind: v.string(),
    tier: v.union(v.literal("a"), v.literal("b")),
    /** Server clock, authoritative for ordering and duration. */
    startedAt: v.number(),
    durationMs: v.optional(v.number()),
    /** Characters inserted, milliseconds absent — whatever the kind measures. */
    magnitude: v.optional(v.number()),
    /** Client's own clock, kept only so disagreement can be measured. */
    clientReportedAt: v.optional(v.number()),
    clockSkewMs: v.optional(v.number()),
    metadata: v.optional(v.string()),
  })
    .index("by_interview", ["interviewId"])
    .index("by_candidate", ["candidateClerkId"])
    .index("by_created_at", ["startedAt"]),

  /**
   * Session-level facts that are not events: what was checked, not what fired.
   *
   * This is what lets a report distinguish "checked and clean" from "never
   * checked" — without it, a browser that cannot detect displays looks identical
   * to one that looked and found nothing.
   */
  proctoringSessions: defineTable({
    interviewId: v.id("interviews"),
    streamCallId: v.string(),
    candidateClerkId: v.string(),
    /**
     * The mode that was in force for this session, copied from the interview
     * when the session opened.
     *
     * Without it a clean report from `observe` is indistinguishable from a clean
     * report from `deterrent`, and those mean entirely different things — one
     * says nothing was seen, the other says nothing was seen while rules were
     * being enforced. Every report header states this.
     */
    integrityMode: v.optional(v.string()),
    /**
     * Whether the browser was actually enforcing, as reported by the client.
     *
     * The mode above says what was scheduled; this says whether the enforcement
     * kill switch was on when the candidate joined. Without it, a `deterrent`
     * session run while enforcement was disabled would read as though fullscreen
     * had been required and simply never left.
     *
     * Client-reported, and safe to be: claiming `false` gains a candidate
     * nothing, because it disables no server-side recording and makes the report
     * read "rules were not enforced" — which invites scrutiny rather than
     * deflecting it.
     */
    enforcementActive: v.optional(v.boolean()),
    /**
     * Total time the problem and editor were hidden because the candidate left
     * fullscreen. Duration is the measure, not the number of exits: "hidden for
     * four minutes" is something an interviewer can weigh, "left fullscreen
     * three times" is not.
     */
    maskedMs: v.optional(v.number()),
    /** Set when the candidate declared fullscreen unusable. Never hidden from the report. */
    fullscreenExemptedAt: v.optional(v.number()),
    fullscreenExemptionReason: v.optional(v.string()),
    /** Absent means the candidate never acknowledged the disclosure. */
    disclosureAcknowledgedAt: v.optional(v.number()),
    startedAt: v.number(),
    lastHeartbeatAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    /** "extended" | "single" | "unsupported" — never collapse the last two. */
    displaySupport: v.string(),
    extendedAppearedMidSession: v.optional(v.boolean()),
    /** False means fullscreen exits were never detectable. */
    fullscreenUsed: v.optional(v.boolean()),
    userAgent: v.optional(v.string()),
    monitorGaps: v.optional(v.number()),
    maxClockSkewMs: v.optional(v.number()),
    /**
     * Durable event counter, used as the rate limit.
     *
     * The in-memory limiter in src/lib/rateLimit.ts is per-process, and Convex
     * functions run in isolates that do not reliably share memory, so it cannot
     * bound anything here. A counter on the row is authoritative.
     */
    eventsRecorded: v.optional(v.number()),
    /** Same counter, for authorship segments, which have their own cap. */
    authorshipSegmentsRecorded: v.optional(v.number()),
    /** Set once when the cap is hit, so throttling is visible rather than silent. */
    throttledAt: v.optional(v.number()),
  })
    .index("by_interview", ["interviewId"])
    .index("by_candidate", ["candidateClerkId"]),

  /**
   * How the solution came to exist: the edit history of the candidate's buffer.
   *
   * This is the only signal in the system that touches the way people actually
   * cheat now. Invisible AI overlay assistants produce no tab switch, no blur
   * and no paste — the candidate reads an answer and types it out — so every
   * other detector here reports them as spotless. What remains visible is *how*
   * the typing happened, and that is what these rows describe.
   *
   * It is an edit history, not a keystroke biometric. Raw inter-key intervals
   * are reduced to a mean and a standard deviation in the browser and dropped;
   * only the statistics are stored, and they cannot be inverted into a template
   * that identifies anyone. Storing the raw vector instead would reintroduce
   * GDPR Article 9 special-category data, which v1 deliberately refused —
   * treat any such change as a new design decision rather than a refactor.
   *
   * One row per flushed batch rather than per segment, and one segment per run
   * of editing rather than per keystroke. Naively this would be several thousand
   * writes an interview; coalesced and batched it is a few dozen.
   */
  proctoringAuthorship: defineTable({
    interviewId: v.id("interviews"),
    streamCallId: v.string(),
    candidateClerkId: v.string(),
    /** Batch ordering, server-assigned so a client cannot reorder its history. */
    sequence: v.number(),
    /** Server clock, authoritative as everywhere else in proctoring. */
    recordedAt: v.number(),
    segments: v.array(
      v.object({
        /** Milliseconds from the start of the session, not a wall clock. */
        tOffsetMs: v.number(),
        op: v.string(),
        charCount: v.number(),
        keystrokeCount: v.number(),
        backspaceCount: v.number(),
        durationMs: v.number(),
        meanInterKeyMs: v.number(),
        stdDevInterKeyMs: v.number(),
        /** Inserted text, capped. Absent for deletions, which need only a length. */
        text: v.optional(v.string()),
        viaPaste: v.boolean(),
        language: v.string(),
        questionId: v.string(),
      }),
    ),
  })
    .index("by_interview", ["interviewId"])
    .index("by_interview_sequence", ["interviewId", "sequence"])
    .index("by_created_at", ["recordedAt"]),

  invitations: defineTable({
    email: v.string(),
    role: privilegedInvitationRole,
    tokenHash: v.optional(v.string()),
    invitedBy: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
      v.literal("expired"),
    ),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    lastSentAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    acceptedBy: v.optional(v.string()),
    revokedAt: v.optional(v.number()),
    revokedBy: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_email_status", ["email", "status"])
    .index("by_token_hash", ["tokenHash"])
    .index("by_status", ["status"]),

  auditLogs: defineTable({
    action: v.string(),
    actorClerkId: v.optional(v.string()),
    actorEmail: v.optional(v.string()),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_target_type", ["targetType"])
    .index("by_actor_clerk_id", ["actorClerkId"])
    // getRecentAuditLogs orders by creation time, and the metrics rollup reads
    // sign-in events by day; neither had a supporting index.
    .index("by_created_at", ["createdAt"]),

  /**
   * One row per UTC day. Pre-aggregated so the growth dashboard is a bounded
   * read: computing these live would mean full-table scans of users, audit logs
   * and operational events on every dashboard load.
   */
  dailyMetrics: defineTable({
    /** UTC calendar day as YYYY-MM-DD. */
    date: v.string(),
    signups: v.number(),
    activeUsers: v.number(),
    meetingsStarted: v.number(),
    codeRuns: v.number(),
    codeRunFailures: v.number(),
    codeRunQueueRejections: v.number(),
    /**
     * Total accounts as of this rollup. Optional so existing rows need no
     * backfill. Counted here, in a daily internal cron, rather than in
     * getGrowthDashboard, which used to scan the whole users table on every
     * developer-dashboard load.
     */
    totalUsers: v.optional(v.number()),
    computedAt: v.number(),
  }).index("by_date", ["date"]),

  notifications: defineTable({
    recipientClerkId: v.string(),
    interviewId: v.optional(v.id("interviews")),
    type: v.string(),
    channel: v.optional(notificationChannel),
    category: v.optional(notificationCategory),
    title: v.string(),
    message: v.string(),
    status: notificationStatus,
    scheduledFor: v.number(),
    sentAt: v.optional(v.number()),
    readAt: v.optional(v.number()),
    deliveryAttempts: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    recipientEmail: v.optional(v.string()),
    timezone: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    metadata: v.optional(v.string()),
  })
    .index("by_recipient_channel", ["recipientClerkId", "channel"])
    .index("by_recipient_status", ["recipientClerkId", "status"])
    .index("by_recipient_scheduled_for", ["recipientClerkId", "scheduledFor"])
    .index("by_status", ["status"]),

  notificationPreferences: defineTable({
    userClerkId: v.string(),
    emailEnabled: v.boolean(),
    inAppEnabled: v.boolean(),
    interviewScheduleEmails: v.boolean(),
    interviewReminderEmails: v.boolean(),
    feedbackReminderEmails: v.boolean(),
    optOutAll: v.boolean(),
    timezone: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user_clerk_id", ["userClerkId"]),

  operationalEvents: defineTable({
    source: v.union(
      v.literal("client"),
      v.literal("server"),
      v.literal("convex"),
      v.literal("webhook"),
    ),
    scope: v.string(),
    level: observabilityLevel,
    message: v.string(),
    requestId: v.optional(v.string()),
    correlationId: v.optional(v.string()),
    userId: v.optional(v.string()),
    interviewId: v.optional(v.string()),
    streamCallId: v.optional(v.string()),
    provider: v.optional(v.string()),
    status: v.optional(v.string()),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_level_created_at", ["level", "createdAt"])
    .index("by_scope_created_at", ["scope", "createdAt"]),

  integrationHealthChecks: defineTable({
    provider: v.string(),
    status: healthStatus,
    message: v.string(),
    latencyMs: v.optional(v.number()),
    metadata: v.optional(v.string()),
    checkedAt: v.number(),
  })
    .index("by_provider_checked_at", ["provider", "checkedAt"])
    .index("by_status_checked_at", ["status", "checkedAt"]),

  webhookEvents: defineTable({
    provider: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    status: v.union(
      v.literal("received"),
      v.literal("processed"),
      v.literal("duplicate"),
      v.literal("failed"),
    ),
    attemptCount: v.number(),
    nextRetryAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    payload: v.optional(v.string()),
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
    correlationId: v.optional(v.string()),
  })
    .index("by_provider_event_id", ["provider", "eventId"])
    .index("by_status_created_at", ["status", "createdAt"]),

  backgroundJobs: defineTable({
    kind: backgroundJobKind,
    status: backgroundJobStatus,
    runAt: v.number(),
    attemptCount: v.number(),
    maxAttempts: v.number(),
    payload: v.optional(v.string()),
    lastError: v.optional(v.string()),
    lastAttemptAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    deadLetterReason: v.optional(v.string()),
    relatedId: v.optional(v.string()),
  })
    .index("by_status_run_at", ["status", "runAt"])
    .index("by_kind_created_at", ["kind", "createdAt"]),

  recoveryOperations: defineTable({
    status: recoveryOperationStatus,
    mode: recoveryOperationMode,
    scope: v.string(),
    summary: v.string(),
    detail: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    externalId: v.optional(v.string()),
    attempts: v.number(),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
    resolution: v.optional(v.string()),
  })
    .index("by_status_created_at", ["status", "createdAt"])
    .index("by_scope_created_at", ["scope", "createdAt"]),

  backupSnapshots: defineTable({
    kind: backupSnapshotKind,
    status: backupSnapshotStatus,
    summary: v.string(),
    scope: v.string(),
    storageLocation: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    restoredAt: v.optional(v.number()),
  })
    .index("by_status_created_at", ["status", "createdAt"])
    .index("by_kind_created_at", ["kind", "createdAt"]),
});
