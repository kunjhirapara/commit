import { useEffect } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { logError } from "@/lib/errors";

export const useLifecycleAutomation = () => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const runLifecycleAutomation = useMutation(api.interviews.runLifecycleAutomation);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    const run = async () => {
      try {
        await runLifecycleAutomation();
      } catch (error) {
        logError("useLifecycleAutomation", error);
      }
    };

    run();
  }, [isAuthenticated, isLoading, runLifecycleAutomation]);
};
