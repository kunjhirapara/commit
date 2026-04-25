/**
 * Nodemailer transport configuration for CodeSync.
 *
 * Uses SMTP env variables to create a reusable transport.
 * Falls back to a "no-op" mode when credentials are missing so the app
 * can run in development without a real SMTP server.
 */

import nodemailer, { type Transporter } from "nodemailer";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Singleton transport
// ---------------------------------------------------------------------------

let transport: Transporter | null = null;

const isSmtpConfigured = () =>
  Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS,
  );

const getTransport = (): Transporter | null => {
  if (transport) return transport;

  if (!isSmtpConfigured()) {
    console.warn(
      "[email/transport] SMTP credentials are not configured. Emails will be logged but NOT sent.",
    );
    return null;
  }

  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
    // Connection pool for better throughput
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    // Reasonable timeouts
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  return transport;
};

// ---------------------------------------------------------------------------
// Send email
// ---------------------------------------------------------------------------

export const sendEmail = async (payload: EmailPayload): Promise<EmailResult> => {
  const fromName = process.env.SMTP_FROM_NAME ?? "CodeSync";
  const fromEmail = process.env.SMTP_FROM_EMAIL ?? "noreply@codesync.dev";

  const mailer = getTransport();

  if (!mailer) {
    // Dev-mode fallback: log instead of sending
    console.info("[email/transport] DEV-MODE email (not sent):", {
      to: payload.to,
      subject: payload.subject,
      fromName,
      fromEmail,
    });

    return {
      success: true,
      messageId: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  try {
    const info = await mailer.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      replyTo: payload.replyTo ?? fromEmail,
      headers: {
        "X-Mailer": "CodeSync-Notification-Service",
      },
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown email send error";

    console.error("[email/transport] Failed to send email:", {
      to: payload.to,
      subject: payload.subject,
      error: message,
    });

    return {
      success: false,
      error: message,
    };
  }
};

// ---------------------------------------------------------------------------
// Verify transport (health check)
// ---------------------------------------------------------------------------

export const verifyTransport = async (): Promise<{
  configured: boolean;
  verified: boolean;
  error?: string;
}> => {
  if (!isSmtpConfigured()) {
    return { configured: false, verified: false, error: "SMTP not configured." };
  }

  const mailer = getTransport();
  if (!mailer) {
    return { configured: false, verified: false, error: "Transport unavailable." };
  }

  try {
    await mailer.verify();
    return { configured: true, verified: true };
  } catch (error) {
    return {
      configured: true,
      verified: false,
      error: error instanceof Error ? error.message : "Unknown verify error",
    };
  }
};
