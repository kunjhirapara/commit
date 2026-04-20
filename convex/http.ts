import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { WebhookEvent } from "@clerk/nextjs/server";
import { Webhook } from "svix";
import { createServerError, logServerError } from "./errorUtils";

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

    if (eventType === "user.created" || eventType === "user.updated") {
      const { id, email_addresses, first_name, last_name, image_url } =
        event.data;
      const email = email_addresses[0].email_address;
      const name = `${first_name || ""} ${last_name || ""}`.trim();

      try {
        await ctx.runMutation(api.users.syncUser, {
          clerkId: id,
          email,
          name,
          image: image_url || undefined,
        });
      } catch (error) {
        logServerError("clerk-webhook.syncUser", error, {
          clerkId: id,
          eventType,
        });
        await ctx.runMutation(internal.observability.recordOperationalEvent, {
          source: "webhook",
          scope: "clerk-webhook.syncUser",
          level: "error",
          message: "Failed to sync Clerk user from webhook.",
          correlationId,
          provider: "clerk",
          userId: id,
          status: eventType,
          metadata: JSON.stringify({ eventType, email }),
        });
        throw createServerError(
          error,
          "Unable to process the webhook payload.",
        );
      }

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
  }),
});

export default http;
