type ErrorMetadata = Record<string, unknown>;

const DEFAULT_PRODUCTION_MESSAGE =
  "Something went wrong. Please try again.";

const CONVEX_PREFIX_PATTERN =
  /^\[CONVEX [^\]]+\]\s*\[Request ID:[^\]]+\]\s*/;
const STACK_TRACE_START_PATTERN = /\s+at\s+[\w$.<]/;
const CALLED_BY_CLIENT_PATTERN = /\s*Called by client\s*$/i;

const isErrorWithMessage = (
  error: unknown,
): error is { message: string } =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof (error as { message: unknown }).message === "string";

export const isDevelopmentEnvironment = () =>
  process.env.NODE_ENV !== "production";

export const getErrorMessage = (error: unknown) => {
  if (isErrorWithMessage(error)) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const stripErrorLabel = (value: string) =>
  value.replace(
    /^(?:(?:Server Error|Uncaught Error|Error):?\s*)+/i,
    "",
  );

export const sanitizeErrorMessage = (
  error: unknown,
  fallbackMessage = DEFAULT_PRODUCTION_MESSAGE,
) => {
  const rawMessage = getErrorMessage(error);

  if (!rawMessage) return fallbackMessage;

  let message = rawMessage.trim();

  message = message.replace(CONVEX_PREFIX_PATTERN, "");
  message = message.replace(CALLED_BY_CLIENT_PATTERN, "");

  const stackTraceStart = message.search(STACK_TRACE_START_PATTERN);
  if (stackTraceStart >= 0) {
    message = message.slice(0, stackTraceStart);
  }

  message = stripErrorLabel(message);
  message = normalizeWhitespace(message);

  return message || fallbackMessage;
};

export const logError = (
  scope: string,
  error: unknown,
  metadata?: ErrorMetadata,
) => {
  const details = {
    source: typeof window === "undefined" ? "server" : "client",
    level: "error",
    scope,
    message: getErrorMessage(error),
    metadata,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  };

  console.error(JSON.stringify(details));

  if (typeof window !== "undefined") {
    void import("./telemetry")
      .then(({ createTelemetryEvent, sendTelemetry }) =>
        sendTelemetry(
          createTelemetryEvent({
            source: "client",
            scope,
            level: "error",
            message: details.message,
            metadata,
          }),
        ),
      )
      .catch(() => undefined);
  }
};

export const getDisplayErrorMessage = (
  error: unknown,
  productionMessage = DEFAULT_PRODUCTION_MESSAGE,
) => {
  if (isDevelopmentEnvironment()) {
    return sanitizeErrorMessage(error, productionMessage);
  }

  return productionMessage;
};

export const createPublicError = (
  error: unknown,
  productionMessage = DEFAULT_PRODUCTION_MESSAGE,
) => new Error(getDisplayErrorMessage(error, productionMessage));

export const getErrorDetails = (error: unknown) =>
  isDevelopmentEnvironment()
    ? sanitizeErrorMessage(error, DEFAULT_PRODUCTION_MESSAGE)
    : undefined;

export const requireEnvVar = (name: string) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
};
