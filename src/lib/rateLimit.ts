/**
 * In-memory sliding-window rate limiter for serverless (Fluid Compute)
 * instance reuse. Not distributed — each warm instance keeps its own
 * counters — but good enough to blunt brute-force / scraping against
 * auth endpoints without needing Redis. If the project later adds
 * Upstash/KV, swap the store here for a shared one.
 */

type Bucket = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, Bucket>();

// Periodically drop stale buckets so the Map doesn't grow unbounded on a
// long-lived warm instance.
const MAX_BUCKETS = 50_000;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
};

/**
 * Fixed-window limiter keyed by an arbitrary string (typically
 * `${routeName}:${ip}`). Returns whether the call is allowed.
 */
export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    if (buckets.size >= MAX_BUCKETS) buckets.clear();
    buckets.set(key, { count: 1, windowStart: now });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: windowMs - (now - existing.windowStart),
    };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, retryAfterMs: 0 };
}

/**
 * Best-effort client IP extraction behind Vercel's proxy.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export function tooManyRequests(retryAfterMs: number): Response {
  return Response.json(
    { error: "too_many_requests" },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
    }
  );
}
