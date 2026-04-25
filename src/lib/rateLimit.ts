type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type ConsumeRateLimitArgs = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
};

const RATE_LIMIT_STORE_KEY = "__commit_rate_limit_store__";

const getRateLimitStore = () => {
  const globalState = globalThis as typeof globalThis & {
    [RATE_LIMIT_STORE_KEY]?: Map<string, RateLimitBucket>;
  };

  globalState[RATE_LIMIT_STORE_KEY] ??= new Map<string, RateLimitBucket>();
  return globalState[RATE_LIMIT_STORE_KEY];
};

export const consumeRateLimit = ({
  key,
  limit,
  windowMs,
  now = Date.now(),
}: ConsumeRateLimitArgs): RateLimitResult => {
  const store = getRateLimitStore();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    const next: RateLimitBucket = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(key, next);

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt: next.resetAt,
      retryAfterMs: 0,
    };
  }

  const nextCount = current.count + 1;
  current.count = nextCount;
  store.set(key, current);

  const remaining = Math.max(0, limit - nextCount);
  const allowed = nextCount <= limit;

  return {
    allowed,
    limit,
    remaining,
    resetAt: current.resetAt,
    retryAfterMs: allowed ? 0 : Math.max(0, current.resetAt - now),
  };
};

export const getRateLimitKey = (
  routeScope: string,
  request: Request,
) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    realIp?.trim() ||
    "unknown";

  return `${routeScope}:${ip}`;
};

export const getRateLimitHeaders = (result: RateLimitResult) => ({
  "X-RateLimit-Limit": String(result.limit),
  "X-RateLimit-Remaining": String(result.remaining),
  "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
  "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
});

export const resetRateLimitStore = () => {
  getRateLimitStore().clear();
};
