"use client";

import { ReactNode, useEffect, useState } from "react";
import { StreamVideo, StreamVideoClient } from "@stream-io/video-react-sdk";
import { streamTokenProvider } from "@/actions/stream.actions";
import { logError } from "@/lib/errors";
import { getValidatedClientEnv } from "@/lib/env";

/**
 * Every value import of the Stream SDK lives here, and nothing imports this
 * module statically — StreamClientProvider pulls it in through next/dynamic.
 * That keeps the SDK out of the bundle for the routes that never show video:
 * the landing page, home, practice, calendar and settings.
 *
 * The SDK stylesheet is deliberately NOT imported here — importing it from a
 * dynamically loaded component still hoists it into the parent stylesheet. It
 * sits on the meeting route instead, the only place Stream renders UI. That is
 * a semantic placement, not a saving: Turbopack merges CSS across a route group,
 * so the 127 KB still reaches every route under (root). Only the JavaScript is
 * genuinely split by this module.
 */
export default function StreamVideoRuntime({
  user,
  children,
}: {
  user: { id: string; name: string; image?: string };
  children: ReactNode;
}) {
  const [client, setClient] = useState<StreamVideoClient>();

  useEffect(() => {
    let didCancel = false;

    try {
      getValidatedClientEnv();
      const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

      if (!apiKey) {
        throw new Error(
          "Missing NEXT_PUBLIC_STREAM_API_KEY. Check your environment configuration.",
        );
      }

      const nextClient = new StreamVideoClient({
        apiKey,
        user: { id: user.id, name: user.name, image: user.image },
        tokenProvider: streamTokenProvider,
      });

      if (!didCancel) setClient(nextClient);

      return () => {
        didCancel = true;
        setClient(undefined);
        nextClient.disconnectUser().catch((error) => {
          logError("StreamVideoRuntime.disconnectUser", error, {
            userId: user.id,
          });
        });
      };
    } catch (error) {
      logError("StreamVideoRuntime.initialize", error, { userId: user.id });
      if (!didCancel) setClient(undefined);
    }
  }, [user.id, user.name, user.image]);

  // Render children regardless of Stream status so a video-service outage or a
  // transient init failure does not take down the signed-in shell. Routes that
  // need Stream surface their own loading and error states via the SDK hooks.
  if (!client) return <>{children}</>;

  return <StreamVideo client={client}>{children}</StreamVideo>;
}
