"use node";

/**
 * Convex Node.js actions for dispatching email notifications.
 *
 * The "use node" directive makes these actions run in a full Node.js
 * environment on Convex's servers, allowing us to use nodemailer directly
 * instead of going through an HTTP call to the Next.js app (which can't
 * be reached from Convex's cloud during development).
 *
 * SMTP credentials must be set as Convex environment variables:
 *   npx convex env set SMTP_HOST <value>
 *   npx convex env set SMTP_PORT <value>
 *   npx convex env set SMTP_USER <value>
 *   npx convex env set SMTP_PASS <value>
 *   npx convex env set SMTP_FROM_NAME <value>
 *   npx convex env set SMTP_FROM_EMAIL <value>
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import nodemailer from "nodemailer";
import { resolveEmailTemplate } from "./emailTemplates";
import type { EmailTemplateData } from "./emailTemplates";

// ---------------------------------------------------------------------------
// Transport (created once per cold start)
// ---------------------------------------------------------------------------

let cachedTransport: nodemailer.Transporter | null = null;

const getTransport = () => {
  if (cachedTransport) return cachedTransport;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    console.warn(
      "[emailActions] SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS via `npx convex env set`.",
    );
    return null;
  }

  cachedTransport = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });

  return cachedTransport;
};

// ---------------------------------------------------------------------------
// dispatchEmailNotification
// ---------------------------------------------------------------------------

export const dispatchEmailNotification = internalAction({
  args: {
    notificationId: v.id("notifications"),
    type: v.string(),
    recipientEmail: v.string(),
    recipientName: v.optional(v.string()),
    interviewTitle: v.optional(v.string()),
    interviewDate: v.optional(v.number()),
    previousDate: v.optional(v.number()),
    feedbackDueAt: v.optional(v.number()),
    timezone: v.optional(v.string()),
    reason: v.optional(v.string()),
    interviewUrl: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    // Build template data
    const templateData: EmailTemplateData = {
      recipientEmail: args.recipientEmail,
      recipientName: args.recipientName,
      interviewTitle: args.interviewTitle,
      interviewDate: args.interviewDate,
      previousDate: args.previousDate,
      feedbackDueAt: args.feedbackDueAt,
      timezone: args.timezone,
      reason: args.reason,
      interviewUrl: args.interviewUrl,
      settingsUrl: `${appUrl}/settings`,
    };

    // Resolve the email template
    const template = resolveEmailTemplate(args.type, templateData);

    if (!template) {
      console.warn(`[emailActions] No template found for type: ${args.type}`);
      await ctx.runMutation(internal.notifications.updateNotificationDelivery, {
        notificationId: args.notificationId,
        status: "failed",
        lastError: `No email template for type: ${args.type}`,
        deliveryAttempts: 1,
      });
      return { success: false, error: `No template for type: ${args.type}` };
    }

    // Get transport
    const transport = getTransport();

    if (!transport) {
      // SMTP not configured — log and mark as failed
      console.info("[emailActions] Would send email (SMTP not configured):", {
        to: args.recipientEmail,
        subject: template.subject,
      });
      await ctx.runMutation(internal.notifications.updateNotificationDelivery, {
        notificationId: args.notificationId,
        status: "failed",
        lastError: "SMTP not configured. Set Convex env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.",
        deliveryAttempts: 1,
      });
      return { success: false, error: "SMTP not configured" };
    }

    // Send the email
    const fromName = process.env.SMTP_FROM_NAME ?? "CodeSync";
    const fromEmail = process.env.SMTP_FROM_EMAIL ?? "noreply@codesync.dev";

    try {
      const info = await transport.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: args.recipientEmail,
        subject: template.subject,
        html: template.html,
      });

      console.info("[emailActions] Email sent:", {
        to: args.recipientEmail,
        subject: template.subject,
        messageId: info.messageId,
      });

      await ctx.runMutation(internal.notifications.updateNotificationDelivery, {
        notificationId: args.notificationId,
        status: "sent",
        providerMessageId: info.messageId,
        deliveryAttempts: 1,
      });

      return { success: true, messageId: info.messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown email error";
      console.error("[emailActions] Email failed:", {
        to: args.recipientEmail,
        error: errorMessage,
      });

      await ctx.runMutation(internal.notifications.updateNotificationDelivery, {
        notificationId: args.notificationId,
        status: "failed",
        lastError: errorMessage,
        deliveryAttempts: 1,
      });

      return { success: false, error: errorMessage };
    }
  },
});

// ---------------------------------------------------------------------------
// checkEmailHealth
// ---------------------------------------------------------------------------

export const checkEmailHealth = internalAction({
  args: {},
  handler: async () => {
    const transport = getTransport();

    if (!transport) {
      return {
        service: "email",
        configured: false,
        verified: false,
        error: "SMTP not configured in Convex env vars.",
      };
    }

    try {
      await transport.verify();
      return { service: "email", configured: true, verified: true };
    } catch (error) {
      return {
        service: "email",
        configured: true,
        verified: false,
        error: error instanceof Error ? error.message : "Verify failed",
      };
    }
  },
});
