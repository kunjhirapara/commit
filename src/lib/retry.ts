export interface RetryOptions {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitter?: boolean;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const retryAsync = async <T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> => {
  const {
    retries = 2,
    minDelayMs = 250,
    maxDelayMs = 3_000,
    factor = 2,
    jitter = true,
    shouldRetry = () => true,
    onRetry,
  } = options;

  const totalAttempts = retries + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === totalAttempts || !shouldRetry(error, attempt)) {
        throw error;
      }
      const base = Math.min(minDelayMs * Math.pow(factor, attempt - 1), maxDelayMs);
      const delay = jitter
        ? Math.floor(base / 2) + Math.floor(Math.random() * base)
        : base;
      onRetry?.(error, attempt, delay);
      await sleep(delay);
    }
  }

  throw lastError;
};

interface NodemailerLikeError {
  code?: string;
  responseCode?: number;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isTransientSmtpError = (error: unknown): boolean => {
  if (!isObject(error)) return true;
  const candidate = error as NodemailerLikeError;

  if (candidate.code === "EAUTH" || candidate.code === "EENVELOPE") {
    return false;
  }
  if (typeof candidate.responseCode === "number") {
    return candidate.responseCode < 500;
  }
  return true;
};
