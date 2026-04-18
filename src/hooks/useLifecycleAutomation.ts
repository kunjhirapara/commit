import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { logError } from "@/lib/errors";

export const useLifecycleAutomation = () => {
  const runLifecycleAutomation = useMutation(api.interviews.runLifecycleAutomation);

  useEffect(() => {
    const run = async () => {
      try {
        await runLifecycleAutomation();
      } catch (error) {
        logError("useLifecycleAutomation", error);
      }
    };

    run();
  }, [runLifecycleAutomation]);
};
