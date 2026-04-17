import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { WebhookEvent } from "@clerk/nextjs/server";
import { Webhook } from "svix";
import { createServerError, logServerError } from "./errorUtils";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logServerError(
        "clerk-webhook.config",
        new Error("Webhook secret not configured"),
      );
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
        throw createServerError(
          error,
          "Unable to process the webhook payload.",
        );
      }
    }
    return new Response("Webhook processed successfully", { status: 200 });
  }),
});

export default http;
