"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDisplayErrorMessage, logError } from "@/lib/errors";

const getInvitationErrorMessage = (error: unknown) => {
  const message =
    error instanceof Error ? error.message : String(error ?? "");

  if (
    message.includes("Sign in with the invited email address") ||
    message.includes("User is not authenticated") ||
    message.includes("must be signed in")
  ) {
    return "Sign in with the invited email address to accept this invitation.";
  }

  if (message.includes("invitation has expired")) {
    return "This invitation has expired. Ask an admin to send a new one.";
  }

  if (message.includes("invitation is invalid")) {
    return "This invitation link is invalid. Open the latest email invitation and try again.";
  }

  return getDisplayErrorMessage(error, "Unable to accept invitation.");
};

export default function AcceptInvitationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isSignedIn } = useUser();
  const acceptInvitation = useMutation(api.users.acceptInvitation);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedRole, setAcceptedRole] = useState<string | null>(null);

  const token = useMemo(
    () => searchParams.get("token")?.trim() ?? "",
    [searchParams],
  );

  const invitedEmail = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

  const handleAccept = async () => {
    if (!token) {
      toast.error("Invitation token is missing.");
      return;
    }

    if (!isSignedIn || !user) {
      toast.error(
        "Sign in with the invited email address to accept this invitation.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await acceptInvitation({ token });
      setAcceptedRole(result.role);
      toast.success(`Access updated to ${result.role}.`);
      router.push("/dashboard");
    } catch (error) {
      logError("AcceptInvitationPage.handleAccept", error, {
        invitedEmail,
      });
      toast.error(getInvitationErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-2xl items-center justify-center py-10">
      <Card className="w-full border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>Accept Role Invitation</CardTitle>
          <CardDescription>
            Confirm this invitation to apply the invited role to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
            <p>Signed in as {invitedEmail ?? "your account"}.</p>
            <p className="mt-2">
              Use the same email address that received the invitation. The link
              expires 24 hours after it was sent.
            </p>
          </div>

          {!token ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">
              This invitation link is missing its token. Open the original email
              invitation and try again.
            </div>
          ) : null}

          {acceptedRole ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-300">
              Your access has been updated to {acceptedRole}. Redirecting to the
              dashboard.
            </div>
          ) : (
            <Button
              className="w-full"
              disabled={!token || isSubmitting}
              onClick={handleAccept}>
              {isSubmitting ? "Accepting invitation..." : "Accept invitation"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
