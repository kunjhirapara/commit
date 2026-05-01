import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Call, useStreamVideoClient } from "@stream-io/video-react-sdk";
import {
  getDisplayErrorMessage,
  getErrorDetails,
  logError,
} from "@/lib/errors";

const useGetCalls = () => {
  const { user, isLoaded: isUserLoaded } = useUser();
  const client = useStreamVideoClient();
  const [calls, setCalls] = useState<Call[]>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | undefined>();

  useEffect(() => {
    const loadCalls = async () => {
      if (!isUserLoaded) return;
      if (!client || !user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setErrorDetails(undefined);

      try {
        const { calls } = await client.queryCalls({
          sort: [{ field: "starts_at", direction: -1 }],
          filter_conditions: {
            starts_at: { $exists: true },
            $or: [
              { created_by_user_id: user.id },
              { members: { $in: [user.id] } },
            ],
          },
        });

        setCalls(calls);
      } catch (error) {
        logError("useGetCalls", error, { userId: user.id });
        setCalls([]);
        setError(
          getDisplayErrorMessage(
            error,
            "We couldn't load your calls right now.",
          ),
        );
        setErrorDetails(getErrorDetails(error));
      } finally {
        setIsLoading(false);
      }
    };

    loadCalls();
  }, [client, user?.id, isUserLoaded]);

  const now = new Date();

  const endedCalls = calls?.filter(({ state: { startsAt, endedAt } }: Call) => {
    return (startsAt && new Date(startsAt) < now) || !!endedAt;
  });

  const upcomingCalls = calls?.filter(({ state: { startsAt } }: Call) => {
    return startsAt && new Date(startsAt) > now;
  });

  const liveCalls = calls?.filter(({ state: { startsAt, endedAt } }: Call) => {
    return startsAt && new Date(startsAt) < now && !endedAt;
  });

  return {
    calls,
    endedCalls,
    upcomingCalls,
    liveCalls,
    isLoading,
    error,
    errorDetails,
  };
};

export default useGetCalls;
