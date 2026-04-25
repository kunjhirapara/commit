import test from "node:test";
import assert from "node:assert/strict";
import {
  consumeRateLimit,
  getRateLimitHeaders,
  getRateLimitKey,
  resetRateLimitStore,
} from "./rateLimit.ts";

test.beforeEach(() => {
  resetRateLimitStore();
});

test("consumeRateLimit allows requests until the limit is reached", () => {
  const first = consumeRateLimit({
    key: "telemetry:127.0.0.1",
    limit: 2,
    windowMs: 60_000,
    now: 1_000,
  });
  const second = consumeRateLimit({
    key: "telemetry:127.0.0.1",
    limit: 2,
    windowMs: 60_000,
    now: 2_000,
  });
  const third = consumeRateLimit({
    key: "telemetry:127.0.0.1",
    limit: 2,
    windowMs: 60_000,
    now: 3_000,
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(third.retryAfterMs, 58_000);
});

test("consumeRateLimit resets after the time window passes", () => {
  consumeRateLimit({
    key: "notifications:127.0.0.1",
    limit: 1,
    windowMs: 10_000,
    now: 1_000,
  });

  const nextWindow = consumeRateLimit({
    key: "notifications:127.0.0.1",
    limit: 1,
    windowMs: 10_000,
    now: 11_001,
  });

  assert.equal(nextWindow.allowed, true);
  assert.equal(nextWindow.remaining, 0);
});

test("getRateLimitKey prefers forwarded IP headers", () => {
  const request = new Request("http://localhost/api/test", {
    headers: {
      "x-forwarded-for": "203.0.113.7, 10.0.0.1",
    },
  });

  assert.equal(getRateLimitKey("telemetry", request), "telemetry:203.0.113.7");
});

test("getRateLimitHeaders returns standard response metadata", () => {
  const result = consumeRateLimit({
    key: "telemetry:127.0.0.1",
    limit: 3,
    windowMs: 60_000,
    now: 1_000,
  });

  assert.deepEqual(getRateLimitHeaders(result), {
    "X-RateLimit-Limit": "3",
    "X-RateLimit-Remaining": "2",
    "X-RateLimit-Reset": "61",
    "Retry-After": "0",
  });
});
