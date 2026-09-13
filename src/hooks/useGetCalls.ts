import { useEffect, useState } from "react";
import { Call, useStreamVideoClient } from "@stream-io/video-react-sdk";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { resolveStreamUserId } from "@/lib/auth/streamIdentity";
import {
  getDisplayErrorMessage,
  getErrorDetails,
  logError,
} from "@/lib/errors";

const useGetCalls = () => {
  const { user, isLoaded: isUserLoaded } = useCurrentUser();
  /**
   * Queried by the id Stream knows them by, not the one the session carries.
   *
   * `created_by_user_id` and `members` hold whatever user_id Stream was given
   * when each call was made, which has always been the Clerk id. Filtering on
   * the Convex document id instead matches nothing, and the failure is silent:
   * no error, just an empty "your calls" list for every migrated user.
   */
  const streamUserId = resolveStreamUserId(user);
  const client = useStreamVideoClient();
  const [calls, setCalls] = useState<Call[]>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | undefined>();

  useEffect(() => {
    const loadCalls = async () => {
      if (!isUserLoaded) return;
      if (!client || !streamUserId) {
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
              { created_by_user_id: streamUserId },
              { members: { $in: [streamUserId] } },
            ],
          },
        });

        setCalls(calls);
      } catch (error) {
        logError("useGetCalls", error, { userId: streamUserId });
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
  }, [client, streamUserId, isUserLoaded]);

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
