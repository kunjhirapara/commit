import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentConvexUser,
  mintConvexTokenForCurrentUser,
} from "@/lib/auth/serverSession";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { getValidatedServerEnv } from "@/lib/env";
import { sendEmail, resolveEmailTemplate } from "@/lib/email";
import { absoluteUrl } from "@/lib/siteUrl";

const ALLOWED_ROLES = [
  "interviewer",
  "recruiter",
  "developer",
  "admin",
] as const;

type InvitationRole = (typeof ALLOWED_ROLES)[number];

const isInvitationRole = (value: string): value is InvitationRole =>
  ALLOWED_ROLES.includes(value as InvitationRole);

type CreatedInvitationPayload = {
  invitationId: Id<"invitations">;
  invitationToken: string;
  expiresAt: number;
  email: string;
  role: InvitationRole;
};

const isCreatedInvitationPayload = (
  value: unknown,
): value is CreatedInvitationPayload => {
  if (!value || typeof value !== "object") return false;

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.invitationId === "string" &&
    typeof payload.invitationToken === "string" &&
    typeof payload.expiresAt === "number" &&
    typeof payload.email === "string" &&
    typeof payload.role === "string" &&
    isInvitationRole(payload.role)
  );
};

export async function POST(req: NextRequest) {
  const inviter = await getCurrentConvexUser();
  const env = getValidatedServerEnv();

  if (!inviter) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const role = body.role?.trim() ?? "";

  if (!email || !role || !isInvitationRole(role)) {
    return NextResponse.json(
      { error: "A valid email and role are required." },
      { status: 400 },
    );
  }

  const token = await mintConvexTokenForCurrentUser();
  const convexAuth = {
    token: token ?? undefined,
    url: env.NEXT_PUBLIC_CONVEX_URL,
  };

  const revokeIfPossible = async (invitationId?: Id<"invitations">) => {
    if (!invitationId) return;

    await fetchMutation(
      api.users.revokeInvitation,
      { invitationId },
      convexAuth,
    );
  };

  try {
    const invitationResult = await fetchMutation(
      api.users.inviteUser,
      { email, role },
      convexAuth,
    );

    if (!isCreatedInvitationPayload(invitationResult)) {
      return NextResponse.json(
        {
          error:
            "Invitation was created with an unexpected payload. Restart `npx convex dev` so the updated invitation function is running.",
        },
        { status: 500 },
      );
    }

    const invitation = invitationResult;

    const template = resolveEmailTemplate("access.role_invitation", {
      recipientEmail: invitation.email,
      // The Convex record rather than a provider profile, so the name in the
      // invitation email is the one the rest of the app shows.
      inviterName: inviter.name || inviter.email || "A team admin",
      invitedRole: invitation.role,
      invitationUrl: absoluteUrl(
        `/accept-invitation?token=${encodeURIComponent(invitation.invitationToken)}`,
      ),
      invitationExpiresAt: invitation.expiresAt,
      settingsUrl: absoluteUrl("/settings"),
    });

    if (!template) {
      await revokeIfPossible(invitation.invitationId);
      return NextResponse.json(
        { error: "Invitation email template is unavailable." },
        { status: 500 },
      );
    }

    const result = await sendEmail({
      to: invitation.email,
      subject: template.subject,
      html: template.html,
    });

    if (!result.success) {
      await revokeIfPossible(invitation.invitationId);
      return NextResponse.json(
        {
          error: "Invitation email delivery failed.",
          detail: result.error,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      invitationId: invitation.invitationId,
      expiresAt: invitation.expiresAt,
      messageId: result.messageId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create invitation.",
      },
      { status: 500 },
    );
  }
}
