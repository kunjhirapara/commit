"use server";

import { currentUser } from "@clerk/nextjs/server";
import { StreamClient } from "@stream-io/node-sdk";
import { createPublicError, logError, requireEnvVar } from "@/lib/errors";

export const streamTokenProvider = async () => {
  try {
    const user = await currentUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const streamClient = new StreamClient(
      requireEnvVar("NEXT_PUBLIC_STREAM_API_KEY"),
      requireEnvVar("STREAM_SECRET_KEY"),
    );

    return streamClient.generateUserToken({ user_id: user.id });
  } catch (error) {
    logError("streamTokenProvider", error);

    throw createPublicError(
      error,
      "Unable to initialize the video session right now.",
    );
  }
};
