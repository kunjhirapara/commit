import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const userRole = v.union(
  v.literal("candidate"),
  v.literal("interviewer"),
  v.literal("recruiter"),
  v.literal("admin"),
);

const privilegedInvitationRole = v.union(
  v.literal("interviewer"),
  v.literal("recruiter"),
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
  v.literal("sent"),
  v.literal("read"),
);

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    image: v.optional(v.string()),
    role: userRole,
    clerkId: v.string(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

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
    lifecycleEvents: v.optional(v.array(
      v.object({
        type: v.string(),
        at: v.number(),
        actorClerkId: v.optional(v.string()),
        note: v.optional(v.string()),
      }),
    )),
  })
    .index("by_candidate_id", ["candidateId"])
    .index("by_stream_call_id", ["streamCallId"])
    .index("by_status", ["status"]),

  comments: defineTable({
    content: v.string(),
    rating: v.number(),
    interviewerId: v.string(),
    interviewId: v.id("interviews"),
  }).index("by_interview_id", ["interviewId"]),

  invitations: defineTable({
    email: v.string(),
    role: privilegedInvitationRole,
    invitedBy: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
    ),
    createdAt: v.number(),
    acceptedAt: v.optional(v.number()),
    acceptedBy: v.optional(v.string()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_email_status", ["email", "status"])
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
    .index("by_actor_clerk_id", ["actorClerkId"]),

  notifications: defineTable({
    recipientClerkId: v.string(),
    interviewId: v.optional(v.id("interviews")),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    status: notificationStatus,
    scheduledFor: v.number(),
    sentAt: v.optional(v.number()),
    readAt: v.optional(v.number()),
    metadata: v.optional(v.string()),
  })
    .index("by_recipient_status", ["recipientClerkId", "status"])
    .index("by_recipient_scheduled_for", ["recipientClerkId", "scheduledFor"])
    .index("by_status", ["status"]),
});
