/**
 * POST /api/notifications/email
 *
 * Internal API route called by Convex actions to send email notifications.
 * Accepts a notification payload, resolves the template, and dispatches
 * via nodemailer. Returns delivery status and messageId for tracking.
 *
 * Protected by an internal API key to prevent external abuse.
 */

import { NextRequest, NextResponse } from "next/server";
import { sendEmail, resolveEmailTemplate } from "@/lib/email";
import type { EmailTemplateData } from "@/lib/email";

interface SendEmailRequest {
  type: string;
  recipientEmail: string;
  recipientName?: string;
  interviewTitle?: string;
  interviewDate?: number;
  previousDate?: number;
  feedbackDueAt?: number;
  timezone?: string;
  reason?: string;
  interviewUrl?: string;
  settingsUrl?: string;
  metadata?: Record<string, unknown>;
}

const validateApiKey = (req: NextRequest): boolean => {
  const key = process.env.INTERNAL_API_KEY;
  // In development, skip API key validation if not set
  if (!key) return process.env.NODE_ENV !== "production";

  const authHeader = req.headers.get("x-api-key");
  return authHeader === key;
};

export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: SendEmailRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { type, recipientEmail, ...rest } = body;

  if (!type || !recipientEmail) {
    return NextResponse.json(
      { error: "Missing required fields: type, recipientEmail" },
      { status: 400 },
    );
  }

  const templateData: EmailTemplateData = {
    recipientEmail,
    recipientName: rest.recipientName,
    interviewTitle: rest.interviewTitle,
    interviewDate: rest.interviewDate,
    previousDate: rest.previousDate,
    feedbackDueAt: rest.feedbackDueAt,
    timezone: rest.timezone,
    reason: rest.reason,
    interviewUrl: rest.interviewUrl,
    settingsUrl: rest.settingsUrl ?? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/settings`,
    metadata: rest.metadata,
  };

  const template = resolveEmailTemplate(type, templateData);

  if (!template) {
    return NextResponse.json(
      { error: `No email template found for type: ${type}` },
      { status: 422 },
    );
  }

  const result = await sendEmail({
    to: recipientEmail,
    subject: template.subject,
    html: template.html,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Email delivery failed",
        detail: result.error,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    messageId: result.messageId,
    sentAt: Date.now(),
  });
}
