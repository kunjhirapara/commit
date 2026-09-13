"use server";

import {
  getCurrentConvexUser,
  getCurrentUserId,
  mintConvexTokenForCurrentUser,
} from "@/lib/auth/serverSession";
import { resolveStreamUserId } from "@/lib/auth/streamIdentity";
import { StreamClient } from "@stream-io/node-sdk";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { createPublicError, logError, requireEnvVar } from "@/lib/errors";
import { getValidatedServerEnv } from "@/lib/env";

export type AuthorizedRecording = {
  interviewId?: string;
  title?: string;
  streamCallId: string;
  scheduledStartTime: number;
  retentionExpiresAt?: number;
  url: string;
  filename?: string;
  startTime?: string;
  endTime?: string;
};

export const streamTokenProvider = async () => {
  try {
    const user = await getCurrentConvexUser();
    getValidatedServerEnv();

    if (!user) {
      throw new Error("User not authenticated");
    }

    /**
     * The id Stream knows them by, which is no longer the id we know them by.
     *
     * Stream keys calls and recordings by the user_id it was given, and that
     * has always been the Clerk id. Passing the Convex document id here would
     * mint a valid token for a user Stream has never seen: no error, just an
     * empty list where their interviews used to be.
     */
    const streamUserId = resolveStreamUserId(user);

    if (!streamUserId) {
      throw new Error("User has no Stream identity");
    }

    const streamClient = new StreamClient(
      requireEnvVar("NEXT_PUBLIC_STREAM_API_KEY"),
      requireEnvVar("STREAM_SECRET_KEY"),
    );

    return streamClient.generateUserToken({ user_id: streamUserId });
  } catch (error) {
    logError("streamTokenProvider", error);

    throw createPublicError(
      error,
      "Unable to initialize the video session right now.",
    );
  }
};

export const listAuthorizedRecordings = async (): Promise<AuthorizedRecording[]> => {
  try {
    const userId = await getCurrentUserId();
    const env = getValidatedServerEnv();

    if (!userId) {
      throw new Error("User not authenticated");
    }

    const token = await mintConvexTokenForCurrentUser();
    const interviews = await fetchQuery(
      api.interviews.getAuthorizedRecordingInterviews,
      {},
      {
        token: token ?? undefined,
        url: env.NEXT_PUBLIC_CONVEX_URL,
      },
    );

    const streamClient = new StreamClient(
      env.NEXT_PUBLIC_STREAM_API_KEY,
      env.STREAM_SECRET_KEY,
    );

    const recordings = await Promise.all(
      interviews.map(async (interview) => {
        try {
          const response = await streamClient.video
            .call("default", interview.streamCallId)
            .listRecordings();

          return (response.recordings ?? []).map((recording) => ({
            interviewId: interview.interviewId,
            title: interview.title,
            streamCallId: interview.streamCallId,
            scheduledStartTime: interview.scheduledStartTime,
            retentionExpiresAt: interview.retentionExpiresAt,
            url: recording.url,
            filename: recording.filename,
            startTime: recording.start_time?.toISOString(),
            endTime: recording.end_time?.toISOString(),
          }));
        } catch (error) {
          logError("listAuthorizedRecordings.listRecordings", error, {
            interviewId: interview.interviewId,
            streamCallId: interview.streamCallId,
          });
          return [];
        }
      }),
    );

    return recordings
      .flat()
      .sort((a, b) => {
        const aTime = a.startTime
          ? new Date(a.startTime).getTime()
          : a.scheduledStartTime;
        const bTime = b.startTime
          ? new Date(b.startTime).getTime()
          : b.scheduledStartTime;

        return bTime - aTime;
      });
  } catch (error) {
    logError("listAuthorizedRecordings", error);
    throw createPublicError(
      error,
      "Unable to load authorized recordings right now.",
    );
  }
};

export const endInterviewMeeting = async ({
  streamCallId,
}: {
  streamCallId: string;
}) => {
  try {
    const userId = await getCurrentUserId();
    const env = getValidatedServerEnv();

    if (!userId) {
      throw new Error("User not authenticated");
    }

    const token = await mintConvexTokenForCurrentUser();
    const convexAuth = {
      token: token ?? undefined,
      url: env.NEXT_PUBLIC_CONVEX_URL,
    };

    const streamClient = new StreamClient(
      env.NEXT_PUBLIC_STREAM_API_KEY,
      env.STREAM_SECRET_KEY,
    );
    const streamCall = streamClient.video.call("default", streamCallId);

    const [interview, viewer] = await Promise.all([
      fetchQuery(
        api.interviews.getInterviewByStreamCallId,
        { streamCallId },
        convexAuth,
      ),
      fetchQuery(api.users.getCurrentUser, {}, convexAuth),
    ]);

    if (!viewer) {
      throw new Error("User not authenticated");
    }

    if (interview) {
      const isHost =
        viewer.role === "admin" ||
        (viewer.role === "interviewer" &&
          interview.interviewerIds.includes(viewer.clerkId));

      if (!isHost) {
        throw new Error("Only the host can end this meeting.");
      }

      // End the call session for all participants without deleting the call record.
      // Deleting would erase recordings; ending keeps them while preventing rejoin.
      await streamCall.end();

      await Promise.all([
        fetchMutation(
          api.sessionEvents.logSessionEvent,
          {
            interviewId: interview._id,
            streamCallId,
            type: "host.ended_session",
            detail: "Host ended the session for everyone",
          },
          convexAuth,
        ),
        fetchMutation(
          api.interviews.updateInterviewStatus,
          {
            interviewId: interview._id,
            status: "completed",
          },
          convexAuth,
        ),
      ]);
    } else {
      const response = await streamCall.get();
      const createdById = response.call.created_by?.id;
      // Compared against the Stream identity, not the session id. Stream
      // recorded created_by as the Clerk id; under Auth.js `userId` is the
      // Convex document id, so comparing that would never match and nobody
      // could end an ad-hoc meeting they had started themselves.
      const isStreamHost =
        (createdById && createdById === resolveStreamUserId(viewer)) ||
        viewer.role === "admin";

      if (!isStreamHost) {
        throw new Error("Only the host can end this meeting.");
      }

      // No backing interview record — end the session without deleting so any
      // recordings are preserved.
      await streamCall.end();
    }

    return { ok: true };
  } catch (error) {
    logError("endInterviewMeeting", error, { streamCallId });
    throw createPublicError(error, "Failed to end meeting.");
  }
};
