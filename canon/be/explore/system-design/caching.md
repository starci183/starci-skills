# Caching

A cache is a second copy of the truth with no owner. Every rule below exists because that second
copy will disagree with the first one, and the only questions worth settling in advance are *for how
long*, *who notices*, and *what happens when everybody misses at once*. Teams reach for a cache to
fix latency and inherit a correctness problem they did not budget for, which is why the decision
"what may be stale, and by how much" has to be made before the decision "where do we put Redis".

## The test

**Every cached value has a stated maximum staleness, an owner that invalidates it, and a finite TTL
that would eventually fix it even if that owner never ran.**

## The rules

- **Cache-aside is the default; write-through is a decision you justify.** In cache-aside (Microsoft
  Cloud Design Patterns, *Cache-Aside*; AWS ElastiCache calls it lazy loading) the reader fills the
  cache on a miss, so the cache only ever holds keys somebody actually reads, and a cache outage
  degrades to a slow read rather than a failed request. Write-through fills on write instead: it
  removes the cold-start latency of a key that must be fast on its first read, but it puts the cache
  inside the write's failure domain. Before choosing it, answer the question it forces — does a
  failed cache write fail the request (availability now depends on the cache) or is it best-effort
  (you are back to invalidation, with a wider window)? Write-behind, where the cache acknowledges and
  the store is updated later, loses recent writes when a cache node dies; it does not belong in front
  of anything transactional.
- **On write, delete the key; do not update it.** Updating the cache from the writer races with a
  concurrent reader that is already holding an older value and about to write it back, and the loser
  of that race resurrects stale data with a full fresh TTL in front of it. Deletion is idempotent and
  forces the next reader to re-derive from the store. This is the invalidate-don't-update rule from
  *Scaling Memcache at Facebook* (Nishtala et al., NSDI 2013), and it is the single cheapest thing
  that removes a whole class of "the cache is showing yesterday" incidents.
- **TTL is the backstop for the invalidation you will forget, so nothing is cached forever.** Choose
  the number from how wrong the value is allowed to be, not from how expensive it is to compute. A
  price may be five seconds stale; a permissions decision may be zero seconds stale; a rendered
  article may be an hour stale. An unbounded TTL means one missed invalidation is permanent, and the
  only recovery is a human flushing a key from a console at the worst possible time.
- **Know your layers and add up their TTLs.** A request can be answered from the browser cache, a
  shared cache or CDN, a per-instance in-process cache (a `cacheable`/Keyv LRU inside the Node
  process), a distributed cache (Redis), and finally the database's own buffers. Worst-case staleness
  is the *sum* of the TTLs a value passes through, not the largest of them. Only the layers you can
  reach are invalidatable: you can delete a Redis key, you can purge a CDN, you cannot recall a
  response already sitting in someone's browser. That asymmetry is the reason authenticated responses
  carry `Cache-Control: no-store` (RFC 9111 §5.2.2.5) rather than a short max-age.
- **A per-instance cache is not a cache, it is N caches.** With more than one replica, an in-process
  LRU gives each replica its own answer, so a user hitting two replicas sees two truths and an
  invalidation event has to fan out to every process. It is the right tool for immutable data
  (a parsed config, a compiled template, a JWKS key set) and the wrong tool for anything a write path
  can change.
- **The cache key must contain every dimension the value depends on.** Missing the subject is the
  classic one: a key of `profile:current` served from a shared cache hands one user's record to the
  next. Missing the locale, the tenant, the API version or the feature flag produces the same bug
  more quietly. Where a shared cache or CDN sits in front of authenticated traffic, the cache key
  must include the identity dimension or the route must be marked uncacheable — this is the
  mechanism behind web cache deception and cache poisoning (Omer Gil, 2017; James Kettle, *Practical
  Web Cache Poisoning*, 2018).
- **Protect against the stampede, in this order of cheapness.** A popular key expiring is not one
  miss, it is every concurrent request missing at once and hitting the store together. Three
  mechanisms, and most systems want the first two: a single-flight lock or lease so one caller
  repopulates and the rest wait (the lease mechanism in the Facebook memcache paper); jittered TTLs
  so keys written in the same second do not expire in the same second; and probabilistic early
  expiry, where a reader near the expiry time refreshes voluntarily with probability rising as the
  deadline approaches (Vattani, Chierichetti, Lowenstein, *Optimal Probabilistic Cache Stampede
  Prevention*, VLDB 2015). Stale-while-revalidate (RFC 5861) is the fourth: serve the expired value
  and refresh behind it, when serving slightly stale beats serving slowly.
- **Cache the miss too, but briefly.** Repeated lookups of a key that does not exist bypass the cache
  entirely and land on the store every time, which is how a scraper turns into an outage. A short
  negative TTL fixes the common case; a membership filter in front of the lookup (a Bloom filter over
  the existing ids) fixes the pathological one, at the cost of a small false-positive rate that only
  ever causes an unnecessary store read, never a wrong answer.
- **A cache miss must never be an error.** Wrap every cache read so that a timeout or a connection
  failure logs and falls through to the loader. A dependency that exists to make things faster must
  not be able to make things fail — that is the Integration Point anti-pattern from Nygard's
  *Release It!*, and it is the most common way a Redis blip becomes a full outage.

## What must never be cached

Some of this is machine-checkable, most of it is judgement, and the list is short enough to remember:

- **Credentials, tokens and one-time codes.** Access tokens, refresh tokens, API keys, session
  identifiers, password reset and MFA codes. A cache is a copy with a TTL you chose for performance
  reasons, sitting in a store with different access controls from your database.
- **Authorization decisions keyed on anything less than the whole question.** "May this subject
  perform this action on this object" is only cacheable under exactly that key, and only for as long
  as a revocation may take effect. Caching a coarser answer — a role list, "is admin" — is how a
  removed permission keeps working for the rest of the TTL.
- **Anything you may be legally required to delete on request.** A cached copy with a thirty-day TTL
  is a copy of personal data you have forgotten you hold, and an erasure request has to reach it.
- **Unbounded result sets.** Caching "all rows for this account" makes the Unbounded Result Set
  anti-pattern (*Release It!*) permanent and puts an unpredictable object size in a shared store.
- **Errors, unless deliberately and briefly.** An upstream 500 cached for an hour outlives the
  incident that caused it.

## One worked example

A cache-aside read with single-flight and jittered expiry. Everything in it is defensive against one
named failure, and the comments say which.

```ts
// A cache-aside read: single-flight on the miss, jittered TTL, and a cache that
// can never fail the request.
@Injectable()
export class CachedReader {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  public async read<T>(params: {
    key: string;
    ttlSeconds: number;
    loader: () => Promise<T>;
  }): Promise<T> {
    const { key, ttlSeconds, loader } = params;

    try {
      const hit = await this.redis.get(key);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch (error) {
      // The cache exists to be faster, never to be required: log and read through.
      this.logger.warn("cache read failed", { key, error });
      return loader();
    }

    // Single flight: the first caller to take the lock repopulates, so N concurrent
    // misses on a hot key cost one store read instead of N.
    const lockKey = `${key}:lock`;
    const acquired = await this.redis.set(lockKey, "1", "EX", 10, "NX");
    if (acquired === null) {
      await setTimeoutPromise(50);
      const second = await this.redis.get(key);
      if (second !== null) return JSON.parse(second) as T;
      // The lock holder is slow or died: read through rather than queue behind it.
      return loader();
    }

    try {
      const fresh = await loader();
      // +/-10% jitter so a batch of keys written in the same second does not expire
      // in the same second and stampede together.
      const spread = Math.round(ttlSeconds * (0.9 + Math.random() * 0.2));
      await this.redis.set(key, JSON.stringify(fresh), "EX", spread);
      return fresh;
    } finally {
      await this.redis.del(lockKey);
    }
  }
}

// Wrong: updating the key from the write path. A reader that loaded the old row a
// moment ago can write it back after this line and win, restoring stale data with a
// full TTL in front of it. Delete instead, and let the next reader re-derive.
// await this.redis.set(key, JSON.stringify(updatedRow), "EX", ttl);
```

## What a machine can check, and what it cannot

Checkable: that authenticated HTTP responses carry `Cache-Control: no-store`, by asserting it in an
interceptor and covering it with one end-to-end test; that no cache write uses an infinite TTL, by
requiring a TTL argument in the wrapper's signature so omitting it does not compile; that no secret
field name appears in a cache payload, by serialising a fixture through the same path in a unit test.

Judgement: the TTL number itself, whether a value tolerates staleness at all, and whether a given key
carries every dimension it depends on. No linter knows that a response varies by tenant. That one is
caught by asking, for every new cached read, "which two users could this be served to".

Related: `resilience.md` (a cache is a remote call, so it takes a timeout like every other one) and
`auth-and-authz.md` (why an authorization decision is the value you are least allowed to cache).
