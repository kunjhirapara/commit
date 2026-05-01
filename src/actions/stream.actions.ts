"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
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
    const user = await currentUser();
    getValidatedServerEnv();

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

export const listAuthorizedRecordings = async (): Promise<AuthorizedRecording[]> => {
  try {
    const { userId, getToken } = await auth();
    const env = getValidatedServerEnv();

    if (!userId) {
      throw new Error("User not authenticated");
    }

    const token = await getToken({ template: "convex" });
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
    const { userId, getToken } = await auth();
    const env = getValidatedServerEnv();

    if (!userId) {
      throw new Error("User not authenticated");
    }

    const token = await getToken({ template: "convex" });
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

    if (interview) {
      const isHost =
        viewer.role === "admin" ||
        (viewer.role === "interviewer" &&
          interview.interviewerIds.includes(viewer.clerkId));

      if (!isHost) {
        throw new Error("Only the host can end this meeting.");
      }

      // Soft-delete the call so the meeting URL no longer resolves via Stream.
      // Stream will end the active session for everyone before deleting it.
      await streamCall.delete({ hard: false });

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
      const isStreamHost = createdById === userId || viewer.role === "admin";

      if (!isStreamHost) {
        throw new Error("Only the host can end this meeting.");
      }

      // No backing interview record exists, so fall back to Stream ownership
      // and remove the call from the API entirely for future joins.
      await streamCall.delete({ hard: false });
    }

    return { ok: true };
  } catch (error) {
    logError("endInterviewMeeting", error, { streamCallId });
    throw createPublicError(error, "Failed to end meeting.");
  }
};
