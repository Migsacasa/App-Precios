type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  return "unknown";
}

function pruneExpired(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function rateLimitRequest(req: Request, options: RateLimitOptions): {
  ok: boolean;
  headers: HeadersInit;
} {
  const now = Date.now();
  pruneExpired(now);

  const ip = getClientIp(req);
  const bucketKey = `${options.key}:${ip}`;

  const existing = buckets.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(bucketKey, { count: 1, resetAt });
    return {
      ok: true,
      headers: {
        "X-RateLimit-Limit": String(options.limit),
        "X-RateLimit-Remaining": String(Math.max(0, options.limit - 1)),
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
      },
    };
  }

  existing.count += 1;
  const remaining = Math.max(0, options.limit - existing.count);
  const ok = existing.count <= options.limit;

  return {
    ok,
    headers: {
      "X-RateLimit-Limit": String(options.limit),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(Math.ceil(existing.resetAt / 1000)),
      ...(ok ? {} : { "Retry-After": String(Math.max(1, Math.ceil((existing.resetAt - now) / 1000))) }),
    },
  };
}
