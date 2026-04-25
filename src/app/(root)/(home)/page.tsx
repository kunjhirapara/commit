"use client";
import ActionCard from "@/components/ui/ActionCard";
import { QUICK_ACTIONS } from "@/constants";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/../convex/_generated/api";
import { useRouter } from "next/navigation";
import MeetingModal from "@/components/ui/MeetingModal";
import LoaderUI from "@/components/ui/LoaderUI";
import { Loader2Icon } from "lucide-react";
import MeetingCard from "@/components/ui/MeetingCard";
import NotificationsPanel from "@/components/ui/NotificationsPanel";
import { Button } from "@/components/ui/button";
import { useLifecycleAutomation } from "@/hooks/useLifecycleAutomation";

export default function Home() {
  const router = useRouter();
  useLifecycleAutomation();

  const {
    isInterviewer,
    isCandidate,
    isLoading,
    canAccessDeveloperTools,
    canScheduleInterviews,
    canViewRecordings,
  } = useUserRole();

  const interviews = useQuery(api.interviews.getMyInterviews, {});
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

  if (isLoading) return <LoaderUI />;
  return (
    <div className="container max-w-7xl mx-auto p-6">
      {isCandidate &&
        <div className="rounded-lg bg-card p-6 border shadow-xs mb-10">
          <h1 className="text-4xl font-bold text-primary">
            Welcome back!
          </h1>
          <p className="text-muted-foreground mt-2">
            "Access your upcoming interviews and preparations"
          </p>
        </div>
      }
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
              <div className="flex justify-center py-12">
                <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
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
