/**
 * POST /api/execute
 *
 * Runs user-submitted code inside an ephemeral Docker container on the server.
 * The request body is validated before spawning a container.
 *
 * Body schema:
 *   { language: "javascript" | "python" | "java", code: string }
 *
 * Response schema:
 *   { stdout, stderr, exitCode, timedOut, executionMs }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runCodeInDocker } from "@/lib/docker-runner";

const bodySchema = z.object({
  language: z.enum(["javascript", "python", "java"]),
  code: z
    .string()
    .min(1, "Code must not be empty.")
    .max(50_000, "Code exceeds the 50 KB limit."),
});

export async function POST(req: NextRequest) {
  // --- Parse & validate body ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 422 }
    );
  }

  const { language, code } = parsed.data;

  // --- Execute inside Docker ---
  try {
    const result = await runCodeInDocker(language, code);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution failed.";
    console.error("[/api/execute] Unexpected error:", message);
    return NextResponse.json(
      {
        stdout: "",
        stderr: message,
        exitCode: 1,
        timedOut: false,
        executionMs: 0,
      },
      { status: 200 } // Return 200 so the client can display the error inline
    );
  }
}
