import { useEffect, useState } from "react";
import { Call, useStreamVideoClient } from "@stream-io/video-react-sdk";
import {
  getDisplayErrorMessage,
  getErrorDetails,
  logError,
} from "@/lib/errors";

const useGetCallById = (id: string | string[]) => {
  const [call, setCall] = useState<Call>();
  const [isCallLoading, setIsCallLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | undefined>();

  const client = useStreamVideoClient();

  useEffect(() => {
    if (!client) return;

    if (!id) {
      setCall(undefined);
      setError("A meeting id is required.");
      setErrorDetails(undefined);
      setIsCallLoading(false);
      return;
    }

    const getCall = async () => {
      setIsCallLoading(true);
      setError(null);
      setErrorDetails(undefined);

      try {
        const { calls } = await client.queryCalls({
          filter_conditions: { id },
        });

        if (calls.length > 0) {
          setCall(calls[0]);
          return;
        }

        setCall(undefined);
        setError("Meeting not found.");
      } catch (error) {
        logError("useGetCallById", error, { callId: id });
        setCall(undefined);
        setError(
          getDisplayErrorMessage(error, "We couldn't load this meeting."),
        );
        setErrorDetails(getErrorDetails(error));
      } finally {
        setIsCallLoading(false);
      }
    };

    getCall();
  }, [client, id]);

  return { call, isCallLoading, error, errorDetails };
};

export default useGetCallById;
