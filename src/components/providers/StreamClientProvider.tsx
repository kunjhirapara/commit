"use client";

import { ReactNode, useEffect, useState } from "react";
import { StreamVideoClient, StreamVideo } from "@stream-io/video-react-sdk";
import { useUser } from "@clerk/nextjs";
import { streamTokenProvider } from "@/actions/stream.actions";
import { logError } from "@/lib/errors";
import { getValidatedClientEnv } from "@/lib/env";

const StreamClientProvider = ({ children }: { children: ReactNode }) => {
  const [streamVideoClient, setStreamVideoClient] =
    useState<StreamVideoClient>();
  const [clientError, setClientError] = useState<string | null>(null);
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      setStreamVideoClient(undefined);
      setClientError(null);
      return;
    }

    let didCancel = false;

    try {
      const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
      getValidatedClientEnv();

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
          error instanceof Error ? error.message : "Stream init failed",
        );
      }
    }
  }, [user, isLoaded]);

  // Stream is only required by meeting / scheduling / recordings routes.
  // Render the rest of the app (home dashboard, settings, etc.) regardless of
  // Stream status so a video-service outage or transient init failure doesn't
  // take down the whole signed-in shell. Routes that need Stream surface their
  // own loading/error states via the SDK hooks.
  if (clientError || !streamVideoClient) {
    return <>{children}</>;
  }

  return <StreamVideo client={streamVideoClient}>{children}</StreamVideo>;
};

export default StreamClientProvider;
