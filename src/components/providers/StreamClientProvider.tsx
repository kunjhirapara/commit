"use client";

import { ReactNode, useEffect, useState } from "react";
import { StreamVideoClient, StreamVideo } from "@stream-io/video-react-sdk";
import { useUser } from "@clerk/nextjs";
import LoaderUI from "../ui/LoaderUI";
import { streamTokenProvider } from "@/actions/stream.actions";
import ErrorState from "../ui/ErrorState";
import {
  getDisplayErrorMessage,
  getErrorDetails,
  logError,
} from "@/lib/errors";

const StreamClientProvider = ({ children }: { children: ReactNode }) => {
  const [streamVideoClient, setStreamVideoClient] =
    useState<StreamVideoClient>();
  const [clientError, setClientError] = useState<string | null>(null);
  const [clientErrorDetails, setClientErrorDetails] = useState<
    string | undefined
  >();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      setStreamVideoClient(undefined);
      setClientError(null);
      setClientErrorDetails(undefined);
      return;
    }

    let didCancel = false;

    try {
      const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

      if (!apiKey) {
        throw new Error(
          "Missing NEXT_PUBLIC_STREAM_API_KEY. Check your environment configuration.",
        );
      }

      const client = new StreamVideoClient({
        apiKey,
        user: {
          id: user.id,
          name:
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            user.fullName ||
            user.id,
          image: user.imageUrl,
        },
        tokenProvider: streamTokenProvider,
      });

      if (!didCancel) {
        setStreamVideoClient(client);
        setClientError(null);
        setClientErrorDetails(undefined);
      }

      return () => {
        didCancel = true;
        setStreamVideoClient(undefined);
        client.disconnectUser().catch((error) => {
          logError("StreamClientProvider.disconnectUser", error, {
            userId: user.id,
          });
        });
      };
    } catch (error) {
      logError("StreamClientProvider.initialize", error, {
        userId: user.id,
      });

      if (!didCancel) {
        setStreamVideoClient(undefined);
        setClientError(
          getDisplayErrorMessage(
            error,
            "We couldn't connect to video services right now.",
          ),
        );
        setClientErrorDetails(getErrorDetails(error));
      }
    }
  }, [user, isLoaded]);

  if (clientError) {
    return (
      <ErrorState
        title="Video unavailable"
        message={clientError}
        details={clientErrorDetails}
      />
    );
  }

  if (!streamVideoClient) return <LoaderUI />;

  return <StreamVideo client={streamVideoClient}>{children}</StreamVideo>;
};

export default StreamClientProvider;
