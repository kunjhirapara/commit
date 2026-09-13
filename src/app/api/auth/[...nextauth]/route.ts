import { handlers } from "@/auth";

/**
 * The Auth.js route handlers.
 *
 * Node runtime, not Edge: this is where sign-in is actually performed, so it
 * reaches argon2, the Convex adapter and the mail transport. `src/auth.config.ts`
 * is the Edge-safe half that middleware uses.
 */
export const runtime = "nodejs";

export const { GET, POST } = handlers;
