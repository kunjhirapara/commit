"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { CalendarIcon, PlayIcon, UserCheckIcon } from "lucide-react";
import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { logError } from "@/lib/errors";

const POINTS = [
  {
    icon: UserCheckIcon,
    title: "You're signed up as a candidate",
    description:
      "Interviewers schedule rounds with you. Anything booked shows up on your home page and calendar.",
  },
  {
    icon: PlayIcon,
    title: "Practice on your own any time",
    description:
      "Three problems across JavaScript, Python and Java, checked against real test cases in a sandboxed runner.",
  },
  {
    icon: CalendarIcon,
    title: "Keep an eye on your calendar",
    description:
      "Upcoming interviews land there, and you can add your own events around them.",
  },
];

/**
 * First-run welcome.
 *
 * A new signup previously landed on an empty page with no explanation of why it
 * was empty or what to do next. This states the role model up front and points at
 * practice mode, which is the one thing a brand-new candidate can actually do.
 */
export default function OnboardingDialog() {
  const router = useRouter();
  const currentUser = useQuery(api.users.getCurrentUser);
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (currentUser && !currentUser.hasCompletedOnboarding) {
      setOpen(true);
    }
  }, [currentUser]);

  const dismiss = async () => {
    setOpen(false);
    try {
      await completeOnboarding();
    } catch (error) {
      // Non-fatal: worst case the dialog appears again on the next visit.
      logError("OnboardingDialog.completeOnboarding", error);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) void dismiss();
      }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to Commit</DialogTitle>
          <DialogDescription>
            A quick orientation so you know what you can do here.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-4 py-2">
          {POINTS.map((point) => {
            const Icon = point.icon;

            return (
              <li key={point.title} className="flex gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{point.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {point.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => void dismiss()}>
            Look around first
          </Button>
          <Button
            onClick={async () => {
              await dismiss();
              router.push("/practice");
            }}>
            Try a problem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
