type ErrorMetadata = Record<string, unknown>;

const DEFAULT_PRODUCTION_MESSAGE =
  "Something went wrong. Please try again.";

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

export const logError = (
  scope: string,
  error: unknown,
  metadata?: ErrorMetadata,
) => {
  const details = {
    message: getErrorMessage(error),
    metadata,
    stack: error instanceof Error ? error.stack : undefined,
  };

  console.error(`[${scope}]`, details);
};

export const getDisplayErrorMessage = (
  error: unknown,
  productionMessage = DEFAULT_PRODUCTION_MESSAGE,
) => {
  if (isDevelopmentEnvironment()) {
    return getErrorMessage(error) || productionMessage;
  }

  return productionMessage;
};

export const createPublicError = (
  error: unknown,
  productionMessage = DEFAULT_PRODUCTION_MESSAGE,
) => new Error(getDisplayErrorMessage(error, productionMessage));

export const getErrorDetails = (error: unknown) =>
  isDevelopmentEnvironment() ? getErrorMessage(error) : undefined;

export const requireEnvVar = (name: string) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
};
