# Resilience

Every call that leaves the process is a place the system can hang. Michael Nygard named this the
Integration Point in *Release It!* (2007, 2nd ed. 2018) and called it the number one killer of
systems, for a reason that survives every change of stack: a remote call that never returns holds a
connection, a request slot and a caller, and when enough of them pile up the service stops answering
calls that had nothing to do with the failing dependency. That is Cascading Failure, and the whole of
this file is the standard set of defences against it.

The rules are cheap individually and worthless individually. A timeout without a bounded retry
converts a slow dependency into a load amplifier; a retry without idempotency converts a timeout into
a double charge; a circuit breaker with no defined fallback only moves the error somewhere newer.

## The test

**Every call that leaves the process has a finite timeout, a bounded queue, a defined behaviour when
the dependency is down, and — if it is retried — an operation that is safe to run twice.**

## The rules

- **A finite timeout on every remote call, taken from the caller's budget.** Defaults are the trap:
  Node's global `fetch` has no timeout at all, `axios` ships `timeout: 0` meaning infinite, and a
  database driver's connect timeout says nothing about how long a query may run. Set the number from
  what the caller can afford — an inbound request with a two-second budget must not wait five seconds
  on a hop three levels down. Propagate the remainder rather than restating a constant at each hop
  (deadline propagation; Google SRE Book, ch. 22 *Addressing Cascading Failures*). Cover it in depth:
  an HTTP timeout in the client does not stop the query, so the store needs its own — Postgres
  `statement_timeout`, and a bounded pool acquire timeout so waiting for a connection is also finite.
- **Retry only what is safe to run twice, and only for the failures worth retrying.** A timeout is
  ambiguous: the work may have completed and only the answer was lost. Retrying a non-idempotent
  write on a timeout is the mechanism behind duplicate orders and double credits. Retry connection
  errors, 429 and 502/503/504; never retry 400 or 422, which will fail identically and only burn the
  budget; treat 409 as a signal, not a retry.
- **Backoff with jitter, bounded attempts, and a retry budget above them.** Plain exponential backoff
  synchronises every client onto the same doubling schedule, so the herd returns together and knocks
  the recovering dependency over again. Full or decorrelated jitter spreads them (Marc Brooker,
  *Timeouts, retries, and backoff with jitter*, AWS Builders' Library; AWS Architecture Blog,
  *Exponential Backoff and Jitter*). Then remember that retries multiply through layers: three
  attempts at three tiers is twenty-seven calls at the bottom for one at the top, which is why the
  ceiling belongs at the client as a *budget* — retries capped as a fraction of overall traffic, so a
  broad failure cannot become a self-inflicted load test (client-side throttling, Google SRE Book,
  ch. 21).
- **Circuit breaker: stop calling a dependency that is failing, and say what you return instead.** The
  breaker (Nygard) trips on a failure ratio, rejects immediately while open, and lets a probe through
  after a cooldown to test recovery. Its value is not that it fails faster; it is that it stops the
  caller's threads and connections from being consumed by a dependency that cannot use them, and
  stops hammering something that is trying to come back. The half of the pattern people skip is the
  answer to "what happens while it is open" — a cached last-known-good value, a reduced response, a
  queued job, or an honest error. Undefined, the breaker just relocates the outage.
- **Bulkheads: one sick dependency may not consume the whole process.** Give each downstream its own
  bounded concurrency and its own queue, so saturating the slow one leaves capacity for the rest
  (Nygard's Bulkhead, after ship compartments). In Node this matters more than it looks: a single
  event loop and one shared connection pool mean unbounded in-flight promises against a stalled
  dependency will starve every other handler. The concrete idiom is a per-dependency semaphore
  (`p-limit`), per-queue concurrency and rate limits in BullMQ, and separate pools rather than one.
  Queues are bounded and reject when full; an unbounded queue does not prevent failure, it hides it
  until memory runs out.
- **No unbounded result set, ever.** Every query carries a limit, every list endpoint paginates, every
  consumer bounds its in-flight messages. Nygard lists this as its own anti-pattern because it is a
  latent one: the query that returns fifty rows in development returns five million after a year, and
  the failure arrives as an out-of-memory kill with no code change to blame.
- **Graceful degradation is designed, not discovered.** Write down, per dependency, what the system
  does without it: search unavailable falls back to a database `LIKE` query; the recommendation
  service unavailable renders the default ordering; the analytics sink unavailable drops events. The
  matching boot rule is that a non-critical dependency must not prevent startup — connect
  best-effort, mark the feature degraded, keep serving — while a critical one must fail fast and
  loudly rather than start half-alive. Liveness and readiness are then different questions and must
  not share a probe: readiness false takes the instance out of rotation, liveness false gets it
  killed, and wiring a dependency check into liveness turns a downstream blip into a restart loop
  (Kubernetes documentation, *Configure Liveness, Readiness and Startup Probes*).
- **Idempotency is the precondition that makes all of the above legal.** At-least-once delivery is
  what brokers actually offer, so consumers must be idempotent receivers (Hohpe & Woolf, *Enterprise
  Integration Patterns*). The industry's operational form is Stripe's: every unsafe write accepts an
  idempotency key supplied by the caller, stable per business intent rather than per attempt, and the
  server stores the outcome against it. Enforce it with a unique constraint inside the same
  transaction as the effect — a ledger row, a processed-message row — because a check followed by an
  insert in application code is a race, and a unique index is not. Anything that still cannot be
  processed goes to a dead letter channel after bounded attempts rather than being retried forever.

## One worked example

One outbound call, carrying a timeout, a bounded retry with decorrelated jitter, and an idempotency
key that makes the retry safe.

```ts
// A retryable outbound write. The idempotency key is derived from the business
// intent, so all three attempts are the same request as far as the peer is concerned.
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 100;
const MAX_BACKOFF_MS = 2_000;

export const postIdempotent = async <T>(params: {
  url: string;
  body: unknown;
  idempotencyKey: string;
  budgetMs: number; // what remains of the caller's deadline, not a per-attempt constant
}): Promise<T> => {
  const { url, body, idempotencyKey, budgetMs } = params;
  const deadline = Date.now() + budgetMs;
  let backoff = BASE_BACKOFF_MS;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new UpstreamTimeoutException({ url, attempt });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(body),
        // Node's fetch has no default timeout. Without this signal the call can
        // hang for as long as the peer keeps the socket open.
        signal: AbortSignal.timeout(Math.min(remaining, 5_000)),
      });

      if (response.ok) return (await response.json()) as T;

      // A rejection the peer will repeat is not worth the budget it would cost.
      if (!RETRYABLE_STATUS.has(response.status)) {
        throw new UpstreamRejectedException({ url, status: response.status });
      }
    } catch (error) {
      // Typed application errors are decisions and propagate; transport failures
      // and aborts fall through to the backoff below.
      if (error instanceof UpstreamRejectedException) throw error;
    }

    // Decorrelated jitter: the next delay is drawn from a widening window rather
    // than doubled, so clients that failed together do not return together.
    backoff = Math.min(
      MAX_BACKOFF_MS,
      Math.round(BASE_BACKOFF_MS + Math.random() * (backoff * 3 - BASE_BACKOFF_MS)),
    );
    await setTimeoutPromise(backoff);
  }

  throw new UpstreamUnavailableException({ url, attempts: MAX_ATTEMPTS });
};

// Wrong: retrying without the key, with no ceiling on the sleep, and on any error.
// The 422 is retried three times to no purpose, and a timeout after a successful
// write charges the customer twice.
// while (true) { try { return await fetch(url, { method: "POST", body }); }
//                catch { await setTimeoutPromise(backoff *= 2); } }
```

The receiving side of that key is the other half, and it belongs in the transaction that performs
the effect: insert the key into a table with a unique index, and treat the unique-violation as "this
one already happened, return the stored outcome" rather than as an error.

## What a machine can check, and what it cannot

Checkable: that no `fetch` call is made without a `signal`, and no `axios` client is constructed
without a `timeout`, via an ESLint `no-restricted-syntax` rule — this is worth writing, because the
omission is invisible in review and fatal in production. That every queue registration declares
`attempts` and a backoff, by requiring them in the wrapper that registers workers. That every
repository method taking a filter also takes a limit, by making the limit a required parameter of the
signature so omission is a type error.

Judgement: the timeout value, what degrades to what, and whether a given write is genuinely
idempotent. That last one is the one to argue about in review, because the type system agrees with
you either way, and the failure only appears under a retry nobody triggered in testing.

Related: `caching.md` (a cache read is a remote call and takes the same timeout, but must never fail
the request) and `observability.md` (a breaker that opens silently is indistinguishable from a
feature nobody uses).
