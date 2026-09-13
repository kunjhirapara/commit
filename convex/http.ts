import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createServerError, logServerError } from "./lib/errorUtils";

const http = httpRouter();

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
