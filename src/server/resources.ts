interface RateBudgetOptions {
  limit: number;
  windowMs: number;
  maxEntries: number;
  now: () => number;
}

interface RateBucket {
  count: number;
  expires: number;
}

type RateDecision =
  { status: 'allowed' } | { status: 'limited'; retryAfter: number } | { status: 'busy' };

/** Bounded fixed windows are process-local. Expired clients never consume capacity. */
export function createRateBudget(options: RateBudgetOptions): (key: string) => RateDecision {
  const buckets = new Map<string, RateBucket>();
  return (key) => {
    const time = options.now();
    for (const [ip, bucket] of buckets) {
      if (bucket.expires <= time) buckets.delete(ip);
    }
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= options.maxEntries) return { status: 'busy' };
      bucket = { count: 0, expires: time + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > options.limit) {
      return {
        status: 'limited',
        retryAfter: Math.max(1, Math.ceil((bucket.expires - time) / 1_000)),
      };
    }
    return { status: 'allowed' };
  };
}

/** Each acquired slot returns its own idempotent release function for a finally block. */
export function createConcurrencyGate(maxConcurrent: number): {
  tryAcquire: () => (() => void) | undefined;
} {
  let concurrent = 0;
  return {
    tryAcquire: () => {
      if (concurrent >= maxConcurrent) return undefined;
      concurrent += 1;
      let released = false;
      return () => {
        if (released) return;
        concurrent -= 1;
        released = true;
      };
    },
  };
}
