"use client";
import ActionCard from "@/components/ui/ActionCard";
import { QUICK_ACTIONS } from "@/constants";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/../convex/_generated/api";
import { useRouter } from "next/navigation";
import MeetingModal from "@/components/ui/MeetingModal";
import MeetingCard from "@/components/ui/MeetingCard";
import NotificationsPanel from "@/components/ui/NotificationsPanel";
import { Button } from "@/components/ui/button";
import { useLifecycleAutomation } from "@/hooks/useLifecycleAutomation";
import { Skeleton } from "@/components/ui/skeleton";

function HomeSkeleton() {
  return (
    <div className="container mx-auto max-w-7xl space-y-8 p-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full max-w-xl space-y-3">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-6 shadow-xs">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="mt-4 space-y-2">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/80 shadow-sm">
        <div className="flex flex-col gap-4 border-b px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
        <div className="space-y-3 p-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/80 px-4 py-3"
            >
              <Skeleton className="mt-1 h-2.5 w-2.5 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-full max-w-md space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-20 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  useLifecycleAutomation();

  const {
    isInterviewer,
    isCandidate,
    isLoading,
    user,
    canAccessDeveloperTools,
    canScheduleInterviews,
    canViewRecordings,
  } = useUserRole();

  const interviews = useQuery(
    api.interviews.getMyInterviews,
    isLoading || !user ? "skip" : {},
  );
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"start" | "join">();
  const handleQuickAction = (title: string) => {
    switch (title) {
      case "New Call":
        setModalType("start");
        setShowModal(true);
        break;
      case "Join Interview":
        setModalType("join");
        setShowModal(true);
        break;
      default:
        router.push(`/${title.toLowerCase()}`);
    }
  };

  const showOperatorActions =
    isInterviewer || canScheduleInterviews || canViewRecordings;

  if (isLoading) return <HomeSkeleton />;
  return (
    <div className="container max-w-7xl mx-auto p-6">
      {isCandidate && (
        <div className="mb-10 flex flex-col gap-4 rounded-lg border bg-card p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-primary">Welcome back!</h1>
            <p className="text-muted-foreground mt-2">
              "Access your upcoming interviews and preparations"
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/calendar")}>
            View Calendar
          </Button>
        </div>
      )}
      {showOperatorActions ? (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {QUICK_ACTIONS.filter((action) => {
              if (action.title === "Schedule") return canScheduleInterviews;
              if (action.title === "Recordings") return canViewRecordings;
              return true;
            }).map((action) => (
              <ActionCard
                key={action.title}
                action={action}
                onClick={() => handleQuickAction(action.title)}
              />
            ))}
          </div>
          <MeetingModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            title={
              modalType === "start" ? "Start a New Call" : "Join an Interview"
            }
            isJoinMeeting={modalType === "join"}
          />
        </>
      ) : canAccessDeveloperTools ? (
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">Developer workspace</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Observability, reliability, notification delivery, and deployment
            controls are now organized inside the new dashboard workspace.
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push("/dashboard/developer")}>
            Open developer workspace
          </Button>
        </div>
      ) : (
        <>
          <div>
            <h1 className="text-3xl font-bold">Your Interviews</h1>
            <p className="text-muted-foreground mt-1">
              View and join your scheduled interviews
            </p>
          </div>

          <div className="mt-8">
            {interviews === undefined ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3.5 w-2/5" />
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <Skeleton className="h-7 w-7 rounded-full" />
                      <Skeleton className="h-7 w-7 rounded-full" />
                    </div>
                    <Skeleton className="h-9 w-full rounded-md" />
                  </div>
                ))}
              </div>
            ) : interviews.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {interviews.map((interview) => (
                  <MeetingCard key={interview._id} interview={interview} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                You have no scheduled interviews at the moment
              </div>
            )}
          </div>
        </>
      )}{" "}
      <div className="mt-8">
        <NotificationsPanel />
      </div>
    </div>
  );
}
