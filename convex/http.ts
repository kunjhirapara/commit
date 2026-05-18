import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { WebhookEvent } from "@clerk/nextjs/server";
import { Webhook } from "svix";
import { createServerError, logServerError } from "./lib/errorUtils";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logServerError(
        "clerk-webhook.config",
        new Error("Webhook secret not configured"),
      );
      await ctx.runMutation(internal.observability.recordOperationalEvent, {
        source: "webhook",
        scope: "clerk-webhook.config",
        level: "critical",
        message: "Clerk webhook secret not configured.",
        correlationId,
        provider: "clerk",
        status: "misconfigured",
      });
      return new Response("Webhook unavailable", { status: 503 });
    }

    const svix_id = req.headers.get("svix-id");
    const svix_timestamp = req.headers.get("svix-timestamp");
    const svix_signature = req.headers.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      logServerError(
        "clerk-webhook.headers",
        new Error("Missing Svix headers"),
      );
      await ctx.runMutation(internal.observability.recordOperationalEvent, {
        source: "webhook",
        scope: "clerk-webhook.headers",
        level: "warn",
        message: "Missing Svix headers.",
        correlationId,
        provider: "clerk",
        status: "rejected",
      });
      return new Response("Invalid webhook request", { status: 400 });
    }

    const payload = await req.json();
    const body = JSON.stringify(payload);

    const wh = new Webhook(webhookSecret);

    let event: WebhookEvent;
    try {
      event = wh.verify(body, {
        svix_id: svix_id,
        svix_timestamp: svix_timestamp,
        svix_signature: svix_signature,
      }) as WebhookEvent;
    } catch (err) {
      logServerError("clerk-webhook.verify", err);
      await ctx.runMutation(internal.observability.recordOperationalEvent, {
        source: "webhook",
        scope: "clerk-webhook.verify",
        level: "error",
        message: "Webhook signature verification failed.",
        correlationId,
        provider: "clerk",
        status: "rejected",
        metadata: JSON.stringify({ svixId: svix_id }),
      });
      return new Response("Invalid signature", { status: 400 });
    }

    const eventType = event.type;
    const existingEvent = await ctx.runQuery(
      internal.reliability.getWebhookEventByProviderEventId,
      {
        provider: "clerk",
        eventId: svix_id,
      },
    );

    if (existingEvent?.status === "processed" || existingEvent?.status === "duplicate") {
      await ctx.runMutation(internal.reliability.recordWebhookReceipt, {
        provider: "clerk",
        eventId: svix_id,
        eventType,
        payload: body,
        correlationId,
      });

      return new Response("Webhook already processed", { status: 200 });
    }

    await ctx.runMutation(internal.reliability.recordWebhookReceipt, {
      provider: "clerk",
      eventId: svix_id,
      eventType,
      payload: body,
      correlationId,
    });

    try {
      if (eventType === "user.created" || eventType === "user.updated") {
        const { id, email_addresses, first_name, last_name, image_url } =
          event.data;
        const email = email_addresses[0].email_address;
        const name = `${first_name || ""} ${last_name || ""}`.trim();

        await ctx.runMutation(api.users.syncUser, {
          clerkId: id,
          email,
          name,
          image: image_url || undefined,
        });

        await ctx.runMutation(internal.auditLogs.recordSystemAuditLog, {
          action: `clerk.${eventType}`,
          actorClerkId: id,
          actorEmail: email,
          targetType: "user",
          targetId: id,
          metadata: JSON.stringify({ eventType }),
        });
      }

      if (eventType === "session.created" || eventType === "session.ended") {
        const sessionData = event.data as { user_id?: string; id?: string };

        await ctx.runMutation(internal.auditLogs.recordSystemAuditLog, {
          action: `clerk.${eventType}`,
          actorClerkId: sessionData.user_id,
          targetType: "session",
          targetId: sessionData.id,
          metadata: JSON.stringify({
            eventType,
            userId: sessionData.user_id,
          }),
        });
      }
      await ctx.runMutation(internal.reliability.markWebhookProcessed, {
        provider: "clerk",
        eventId: svix_id,
      });
      await ctx.runMutation(internal.observability.recordOperationalEvent, {
        source: "webhook",
        scope: "clerk-webhook.processed",
        level: "info",
        message: "Webhook processed successfully.",
        correlationId,
        provider: "clerk",
        status: eventType,
      });
      return new Response("Webhook processed successfully", { status: 200 });
    } catch (error) {
      logServerError("clerk-webhook.process", error, {
        eventType,
        svixId: svix_id,
      });
      await ctx.runMutation(internal.reliability.markWebhookFailed, {
        provider: "clerk",
        eventId: svix_id,
        errorMessage:
          error instanceof Error ? error.message : "Unknown webhook processing error.",
        payload: body,
      });
      await ctx.runMutation(internal.observability.recordOperationalEvent, {
        source: "webhook",
        scope: "clerk-webhook.process",
        level: "error",
        message: "Webhook processing failed and was queued for recovery.",
        correlationId,
        provider: "clerk",
        status: eventType,
        metadata: JSON.stringify({ svixId: svix_id }),
      });
      throw createServerError(error, "Unable to process the webhook payload.");
    }
  }),
});

http.route({
  path: "/internal/backup-record",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const expectedKey = process.env.INTERNAL_API_KEY;
    if (!expectedKey) {
      return new Response("Backup endpoint not configured", { status: 503 });
    }

    const provided = req.headers.get("authorization");
    if (provided !== `Bearer ${expectedKey}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body: {
      status?: unknown;
      summary?: unknown;
      scope?: unknown;
      storageLocation?: unknown;
      notes?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (body.status !== "available" && body.status !== "failed") {
      return new Response("Invalid status", { status: 400 });
    }
    if (typeof body.summary !== "string" || typeof body.scope !== "string") {
      return new Response("Missing summary or scope", { status: 400 });
    }

    await ctx.runMutation(internal.reliability.recordAutomaticBackupResult, {
      status: body.status,
      summary: body.summary,
      scope: body.scope,
      storageLocation:
        typeof body.storageLocation === "string" ? body.storageLocation : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });

    return new Response("OK", { status: 200 });
  }),
});

export default http;
