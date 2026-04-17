import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { useQuery } from "convex/react";

export const useUserRole = () => {
  const { user } = useUser();

  const userData = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : "skip",
  );

  const isLoading = !!user?.id && userData === undefined;

  return {
    isLoading,
    isCandidate: userData?.role === "candidate",
    isInterviewer: userData?.role === "interviewer",
  };
};
