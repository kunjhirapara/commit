/**
 * Email HTML templates for Commit interview platform notifications.
 *
 * Each template returns { subject, html } for use with nodemailer.
 * All date/time values are formatted in the recipient's timezone.
 */

const BRAND_NAME = "Commit";
const BRAND_COLOR = "#6366f1"; // indigo-500
const BRAND_DARK = "#312e81"; // indigo-900
const TEXT_COLOR = "#1e293b";
const MUTED_COLOR = "#64748b";
const BG_COLOR = "#f8fafc";
const CARD_BG = "#ffffff";
const BORDER_COLOR = "#e2e8f0";
const SUCCESS_COLOR = "#22c55e";
const WARNING_COLOR = "#f59e0b";
const DANGER_COLOR = "#ef4444";

// ---------------------------------------------------------------------------
// Shared layout wrapper
// ---------------------------------------------------------------------------

const wrapLayout = (title: string, body: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${BG_COLOR};font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:${TEXT_COLOR};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_COLOR};">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 0;text-align:center;">
              <span style="font-size:22px;font-weight:700;color:${BRAND_COLOR};letter-spacing:-0.5px;">${BRAND_NAME}</span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:${CARD_BG};border:1px solid ${BORDER_COLOR};border-radius:12px;padding:32px 28px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:${MUTED_COLOR};line-height:1.6;">
                You received this email because of your ${BRAND_NAME} account.<br />
                <a href="{{settingsUrl}}" style="color:${BRAND_COLOR};text-decoration:underline;">Manage notification preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const pill = (text: string, color: string) =>
  `<span style="display:inline-block;padding:4px 12px;border-radius:9999px;background-color:${color}15;color:${color};font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">${text}</span>`;

const ctaButton = (label: string, url: string, color = BRAND_COLOR) =>
  `<a href="${url}" style="display:inline-block;padding:12px 28px;background-color:${color};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.02em;">${label}</a>`;

const detailRow = (label: string, value: string) =>
  `<tr>
    <td style="padding:8px 0;font-size:13px;color:${MUTED_COLOR};width:130px;vertical-align:top;">${label}</td>
    <td style="padding:8px 0;font-size:13px;font-weight:500;">${value}</td>
  </tr>`;

// ---------------------------------------------------------------------------
// Timezone-aware date formatting
// ---------------------------------------------------------------------------

const formatDateTime = (timestamp: number, timezone = "UTC") => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString("en-US");
  }
};

// ---------------------------------------------------------------------------
// Template types
// ---------------------------------------------------------------------------

export interface EmailTemplateData {
  recipientName?: string;
  recipientEmail: string;
  inviterName?: string;
  invitedRole?: string;
  invitationUrl?: string;
  invitationExpiresAt?: number;
  interviewTitle?: string;
  interviewDate?: number;
  timezone?: string;
  interviewUrl?: string;
  settingsUrl?: string;
  reason?: string;
  previousDate?: number;
  feedbackDueAt?: number;
  brandName?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailTemplate {
  subject: string;
  html: string;
}

// ---------------------------------------------------------------------------
// Template builders
// ---------------------------------------------------------------------------

export const interviewScheduledTemplate = (data: EmailTemplateData): EmailTemplate => {
  const tz = data.timezone ?? "UTC";
  const dateStr = data.interviewDate ? formatDateTime(data.interviewDate, tz) : "TBD";
  const name = data.recipientName ?? "there";

  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${BRAND_DARK};">Interview Scheduled</h1>
    ${pill("SCHEDULED", SUCCESS_COLOR)}
    <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${TEXT_COLOR};">
      Hi ${name}, your interview has been scheduled. Here are the details:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;width:100%;border-top:1px solid ${BORDER_COLOR};">
      ${detailRow("Interview", data.interviewTitle ?? "—")}
      ${detailRow("Date & Time", dateStr)}
      ${detailRow("Timezone", tz)}
    </table>
    ${data.interviewUrl ? `<div style="text-align:center;margin:28px 0 8px;">${ctaButton("View Interview", data.interviewUrl)}</div>` : ""}
    <p style="margin:24px 0 0;font-size:13px;color:${MUTED_COLOR};line-height:1.6;">
      Please ensure your camera and microphone are working before the session.
    </p>
  `;

  return {
    subject: `📅 Interview Scheduled: ${data.interviewTitle ?? "Upcoming Interview"}`,
    html: wrapLayout("Interview Scheduled", body).replace("{{settingsUrl}}", data.settingsUrl ?? "#"),
  };
};

export const interviewRescheduledTemplate = (data: EmailTemplateData): EmailTemplate => {
  const tz = data.timezone ?? "UTC";
  const newDateStr = data.interviewDate ? formatDateTime(data.interviewDate, tz) : "TBD";
  const oldDateStr = data.previousDate ? formatDateTime(data.previousDate, tz) : "—";
  const name = data.recipientName ?? "there";

  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${BRAND_DARK};">Interview Rescheduled</h1>
    ${pill("RESCHEDULED", WARNING_COLOR)}
    <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${TEXT_COLOR};">
      Hi ${name}, your interview has been rescheduled. Please review the updated details below.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;width:100%;border-top:1px solid ${BORDER_COLOR};">
      ${detailRow("Interview", data.interviewTitle ?? "—")}
      ${detailRow("Previous Time", `<s style="color:${MUTED_COLOR};">${oldDateStr}</s>`)}
      ${detailRow("New Time", `<strong style="color:${BRAND_COLOR};">${newDateStr}</strong>`)}
      ${detailRow("Timezone", tz)}
      ${data.reason ? detailRow("Reason", data.reason) : ""}
    </table>
    ${data.interviewUrl ? `<div style="text-align:center;margin:28px 0 8px;">${ctaButton("View Interview", data.interviewUrl)}</div>` : ""}
  `;

  return {
    subject: `🔄 Interview Rescheduled: ${data.interviewTitle ?? "Interview Update"}`,
    html: wrapLayout("Interview Rescheduled", body).replace("{{settingsUrl}}", data.settingsUrl ?? "#"),
  };
};

export const interviewCancelledTemplate = (data: EmailTemplateData): EmailTemplate => {
  const name = data.recipientName ?? "there";

  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${BRAND_DARK};">Interview Cancelled</h1>
    ${pill("CANCELLED", DANGER_COLOR)}
    <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${TEXT_COLOR};">
      Hi ${name}, unfortunately the following interview has been cancelled.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;width:100%;border-top:1px solid ${BORDER_COLOR};">
      ${detailRow("Interview", data.interviewTitle ?? "—")}
      ${data.reason ? detailRow("Reason", data.reason) : detailRow("Reason", "No reason provided.")}
    </table>
    <p style="margin:24px 0 0;font-size:13px;color:${MUTED_COLOR};line-height:1.6;">
      If you have questions about this cancellation, please contact your recruiter.
    </p>
  `;

  return {
    subject: `❌ Interview Cancelled: ${data.interviewTitle ?? "Interview Update"}`,
    html: wrapLayout("Interview Cancelled", body).replace("{{settingsUrl}}", data.settingsUrl ?? "#"),
  };
};

export const interviewReminderTemplate = (data: EmailTemplateData): EmailTemplate => {
  const tz = data.timezone ?? "UTC";
  const dateStr = data.interviewDate ? formatDateTime(data.interviewDate, tz) : "soon";
  const name = data.recipientName ?? "there";

  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${BRAND_DARK};">Interview Reminder</h1>
    ${pill("STARTING SOON", BRAND_COLOR)}
    <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${TEXT_COLOR};">
      Hi ${name}, this is a friendly reminder that your interview is coming up shortly.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;width:100%;border-top:1px solid ${BORDER_COLOR};">
      ${detailRow("Interview", data.interviewTitle ?? "—")}
      ${detailRow("Starts At", dateStr)}
      ${detailRow("Timezone", tz)}
    </table>
    ${data.interviewUrl ? `<div style="text-align:center;margin:28px 0 8px;">${ctaButton("Join Interview", data.interviewUrl, SUCCESS_COLOR)}</div>` : ""}
    <p style="margin:24px 0 0;font-size:13px;color:${MUTED_COLOR};line-height:1.6;">
      Tip: Test your microphone and camera a few minutes early.
    </p>
  `;

  return {
    subject: `⏰ Reminder: ${data.interviewTitle ?? "Interview"} starts soon`,
    html: wrapLayout("Interview Reminder", body).replace("{{settingsUrl}}", data.settingsUrl ?? "#"),
  };
};

export const feedbackReminderTemplate = (data: EmailTemplateData): EmailTemplate => {
  const tz = data.timezone ?? "UTC";
  const dueStr = data.feedbackDueAt ? formatDateTime(data.feedbackDueAt, tz) : "as soon as possible";
  const name = data.recipientName ?? "there";

  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${BRAND_DARK};">Feedback Reminder</h1>
    ${pill("PENDING FEEDBACK", WARNING_COLOR)}
    <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${TEXT_COLOR};">
      Hi ${name}, please submit your feedback for the interview below.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;width:100%;border-top:1px solid ${BORDER_COLOR};">
      ${detailRow("Interview", data.interviewTitle ?? "—")}
      ${detailRow("Due By", dueStr)}
      ${detailRow("Timezone", tz)}
    </table>
    ${data.interviewUrl ? `<div style="text-align:center;margin:28px 0 8px;">${ctaButton("Submit Feedback", data.interviewUrl, WARNING_COLOR)}</div>` : ""}
    <p style="margin:24px 0 0;font-size:13px;color:${MUTED_COLOR};line-height:1.6;">
      Timely feedback helps maintain a smooth hiring process.
    </p>
  `;

  return {
    subject: `📝 Feedback Due: ${data.interviewTitle ?? "Interview Feedback"}`,
    html: wrapLayout("Feedback Reminder", body).replace("{{settingsUrl}}", data.settingsUrl ?? "#"),
  };
};

export const roleInvitationTemplate = (data: EmailTemplateData): EmailTemplate => {
  const tz = data.timezone ?? "UTC";
  const expiresStr = data.invitationExpiresAt
    ? formatDateTime(data.invitationExpiresAt, tz)
    : "in 24 hours";
  const name = data.recipientName ?? "there";

  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${BRAND_DARK};">Role Invitation</h1>
    ${pill("ACCESS INVITE", BRAND_COLOR)}
    <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${TEXT_COLOR};">
      Hi ${name}, ${data.inviterName ?? "A team admin"} invited you to join ${BRAND_NAME} as <strong>${data.invitedRole ?? "a team member"}</strong>.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;width:100%;border-top:1px solid ${BORDER_COLOR};">
      ${detailRow("Invited Email", data.recipientEmail)}
      ${detailRow("Role", data.invitedRole ?? "Team member")}
      ${detailRow("Expires", expiresStr)}
    </table>
    ${data.invitationUrl ? `<div style="text-align:center;margin:28px 0 8px;">${ctaButton("Accept Invitation", data.invitationUrl)}</div>` : ""}
    <p style="margin:24px 0 0;font-size:13px;color:${MUTED_COLOR};line-height:1.6;">
      Sign in with <strong>${data.recipientEmail}</strong> before accepting. This link expires 24 hours after it was sent.
    </p>
  `;

  return {
    subject: `Role Invitation: ${data.invitedRole ?? "Team Access"}`,
    html: wrapLayout("Role Invitation", body).replace("{{settingsUrl}}", data.settingsUrl ?? "#"),
  };
};

export const systemNotificationTemplate = (data: EmailTemplateData & { systemMessage?: string }): EmailTemplate => {
  const name = data.recipientName ?? "there";

  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${BRAND_DARK};">System Notification</h1>
    ${pill("SYSTEM", MUTED_COLOR)}
    <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${TEXT_COLOR};">
      Hi ${name}, ${data.systemMessage ?? "you have a new system notification."}
    </p>
    ${data.interviewUrl ? `<div style="text-align:center;margin:28px 0 8px;">${ctaButton("View Details", data.interviewUrl)}</div>` : ""}
  `;

  return {
    subject: `${data.brandName ?? BRAND_NAME} – ${data.interviewTitle ?? "System Notification"}`,
    html: wrapLayout("System Notification", body).replace("{{settingsUrl}}", data.settingsUrl ?? "#"),
  };
};

// ---------------------------------------------------------------------------
// Template resolver
// ---------------------------------------------------------------------------

export type NotificationType =
  | "interview.scheduled"
  | "interview.rescheduled"
  | "interview.cancelled"
  | "interview.reminder"
  | "feedback.reminder"
  | "access.role_invitation"
  | "system";

export const resolveEmailTemplate = (
  type: string,
  data: EmailTemplateData,
): EmailTemplate | null => {
  switch (type) {
    case "interview.scheduled":
      return interviewScheduledTemplate(data);
    case "interview.rescheduled":
      return interviewRescheduledTemplate(data);
    case "interview.cancelled":
      return interviewCancelledTemplate(data);
    case "interview.reminder":
      return interviewReminderTemplate(data);
    case "feedback.reminder":
      return feedbackReminderTemplate(data);
    case "access.role_invitation":
      return roleInvitationTemplate(data);
    default:
      if (type.startsWith("system.")) {
        return systemNotificationTemplate(data);
      }
      return null;
  }
};
