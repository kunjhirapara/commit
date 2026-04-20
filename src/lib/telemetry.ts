export type TelemetryLevel = "info" | "warn" | "error" | "critical";
export type TelemetrySource = "client" | "server" | "convex" | "webhook";

export type TelemetryEvent = {
  source: TelemetrySource;
  scope: string;
  level: TelemetryLevel;
  message: string;
  requestId?: string;
  correlationId?: string;
  interviewId?: string;
  streamCallId?: string;
  provider?: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

const CORRELATION_COOKIE = "codesync-correlation-id";

const getClientCorrelationId = () => {
  if (typeof document === "undefined") return undefined;

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CORRELATION_COOKIE}=([^;]*)`),
  );

  return match ? decodeURIComponent(match[1]) : undefined;
};

export const createTelemetryEvent = (
  event: Omit<TelemetryEvent, "correlationId"> & {
    correlationId?: string;
  },
): TelemetryEvent => ({
  ...event,
  correlationId: event.correlationId ?? getClientCorrelationId(),
});

export const sendTelemetry = async (event: TelemetryEvent) => {
  if (typeof window === "undefined") return;

  try {
    await fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...event,
        metadata: event.metadata ? JSON.stringify(event.metadata) : undefined,
      }),
      keepalive: true,
    });
  } catch {
    // Best-effort reporting only.
  }
};
