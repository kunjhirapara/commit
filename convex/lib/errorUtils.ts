const DEFAULT_PRODUCTION_MESSAGE =
  "Something went wrong. Please try again later.";

const isDevelopmentEnvironment = () =>
  process.env.NODE_ENV !== "production";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

export const logServerError = (
  scope: string,
  error: unknown,
  metadata?: Record<string, unknown>,
) => {
  console.error(
    JSON.stringify({
      source: "convex",
      level: "error",
      scope,
      message: getErrorMessage(error),
      metadata,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    }),
  );
};

export const createServerError = (
  error: unknown,
  productionMessage = DEFAULT_PRODUCTION_MESSAGE,
) =>
  new Error(
    isDevelopmentEnvironment()
      ? `${productionMessage} ${getErrorMessage(error)}`
      : productionMessage,
  );

export const requireIdentity = async (
  ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } },
) => {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw createServerError(
      new Error("User is not authenticated"),
      "You must be signed in to perform this action.",
    );
  }

  return identity;
};
