import { useEffect } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { logError } from "@/lib/errors";
import { useUserSyncStatus } from "@/components/providers/UserSyncStatusProvider";

export const useLifecycleAutomation = () => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { status: syncStatus } = useUserSyncStatus();
  const runLifecycleAutomation = useMutation(api.interviews.runLifecycleAutomation);

  useEffect(() => {
    if (isLoading || !isAuthenticated || syncStatus !== "ready") return;

    const run = async () => {
      try {
        await runLifecycleAutomation();
      } catch (error) {
        logError("useLifecycleAutomation", error);
      }
    };

    run();
  }, [isAuthenticated, isLoading, runLifecycleAutomation, syncStatus]);
};
