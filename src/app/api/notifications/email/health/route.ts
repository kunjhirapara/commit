/**
 * GET /api/notifications/email/health
 *
 * Health check endpoint for the email transport.
 * Returns whether SMTP is configured and verified.
 */

import { NextResponse } from "next/server";
import { verifyTransport } from "@/lib/email";

export async function GET() {
  const status = await verifyTransport();

  return NextResponse.json({
    service: "email",
    ...status,
    checkedAt: new Date().toISOString(),
  });
}
