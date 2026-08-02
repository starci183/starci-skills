# Background jobs

Work moves to the background for one of two reasons: it is too slow to hold a request open, or it
must survive the request that started it. Both reasons imply the same architecture — a durable queue
between the two halves — and both imply the same discipline, because the moment work outlives its
caller there is nobody left to retry it by hand or to be told it failed.

Microsoft's Cloud Design Patterns catalogue names the pieces used here: Competing Consumers,
Queue-Based Load Levelling, Async Request-Reply, Priority Queue and Scheduler-Agent-Supervisor. The
concrete idiom is a Nest HTTP or GraphQL handler enqueueing to BullMQ on Redis, a `WorkerHost`
consuming it, and a job row in Postgres tracking progress. The rules hold for any durable queue.

## The handler enqueues, the worker executes, and nothing else

**A request handler's job is to validate, persist, enqueue and return.** It never performs the slow
work, and it never awaits the worker. This is Async Request-Reply: the response is an acknowledgement
carrying an identifier, and the client learns the outcome by polling a resource or receiving a push.
Google's AIP-151 gives that resource a shape — a long-running operation with `done`, a result and an
error — and following it means the client's polling code does not have to be invented per feature.

The consequence people skip: **the identifier must be minted and persisted before the enqueue, not
after.** If the queue accepts the job and the process dies before the row is written, the work runs
against nothing. If the row is written and the enqueue fails, the row records a failure a human or a
sweeper can act on. Only one of those two orderings is recoverable.

```ts
// Persist first; enqueue after; never await the broker in a request path.
const job = await this.jobs.create({
    kind: JobKind.RenderReport,
    payload: this.superJson.stringify(payload),   // SuperJSON, so Date and BigInt survive the trip
})

void this.queue
    .add(job.id, job.payload, { jobId: job.id })  // OUR id as the broker's id: a requeue dedupes
    .catch((error: unknown) =>
        this.jobs.fail({ job, error: `failed to enqueue: ${asError(error).message}` }),
    )

return { jobId: job.id }

// Wrong: awaiting the add ties the response time to broker health for no benefit.
await this.queue.add(job.id, job.payload)
// Wrong: a floating promise with no void and no catch — a broker outage vanishes silently.
this.queue.add(job.id, job.payload)
```

Two machine-checkable rules live in that snippet. `@typescript-eslint/no-floating-promises` (which
needs `parserOptions.project`, so it is a type-aware rule) rejects the third line and forces the
`void` plus `.catch`. And a queue name should come from a central constant map rather than a string
literal, which a `no-restricted-syntax` ESLint rule can enforce against `@InjectQueue` and
`@Processor` call sites — a typo in a literal produces a worker that consumes a queue nobody feeds.

## The job row is the unit of work; the broker's job object is a delivery receipt

The broker knows how many times it tried. It does not know what your work means, it cannot be
queried by your API, and its retention is configured for throughput rather than for audit. So keep
the state of the work in your own table — status, attempt, current step, payload, error, timestamps —
and treat the broker entry as transport.

This is what makes the rest possible: a client can poll it, a sweeper can find jobs stuck in
`Processing` past a deadline, and a redeploy that loses the Redis instance loses throughput rather
than truth.

## Retries are bounded, backed off, jittered, and configured once

Nygard's *Release It!* (2007) supplies the constraint — every remote call has a finite timeout and
retries are bounded — and Marc Brooker's AWS Builders' Library article *Timeouts, retries, and
backoff with jitter* supplies the reason for the jitter: synchronised retries from many clients
reconverge into a thundering herd that keeps the dependency down. Exponential backoff without jitter
spreads load worse than most people expect.

- **Configure `attempts` and `backoff` at the queue, once**, not in each worker. A worker that
  catches, sleeps and retries by hand has quietly built a second retry policy that multiplies with
  the first.
- **The worker's contract on failure is: record the failure on the job row, log it structurally, and
  rethrow.** The rethrow is what hands control back to the queue's policy. Swallowing marks the job
  complete when it is not.
- **Retry only what is idempotent.** A retried non-idempotent step is a duplicate charge. If a step
  calls an external API that supports idempotency keys — Stripe's convention, now widespread — pass a
  key derived from the job identifier and the step index, so the retry is deduplicated at the far end
  rather than hoped about.
- **Distinguish retryable from terminal.** A validation failure, a deleted referent or a 4xx will
  fail identically forever; burning five attempts and a backoff window on it delays every other job.
  Fail terminally on the first attempt and say why.

## A dead-letter queue is a destination, not a log line

Hohpe and Woolf's Dead Letter Channel exists so that an unprocessable message leaves the working set
instead of blocking it. After the last attempt the job moves to a dead-letter destination with its
payload, its error and its attempt history intact, and the working queue moves on.

Three rules keep it from becoming a landfill:

- **The dead-letter queue is monitored, and its depth is an alert.** An unmonitored one is a slower
  way of losing data. Google's SRE Book puts queue depth under saturation, one of the four golden
  signals; a queue that only grows is the clearest possible saturation signal.
- **Draining is a deliberate, replayable operation** — an admin action that re-enqueues after the
  cause is fixed. That works only because consumers are idempotent, so a replay of something that
  half-succeeded is safe. See `messaging-and-events.md`.
- **Nothing is deleted from it silently.** The whole point was to keep the evidence.

## Scheduled and event-triggered work answer different questions

**Event-triggered** is the default: something happened, so something should be done. It is prompt,
it scales with the actual event rate, and it leaves a causal trail.

**Scheduled** work is for what no event announces — a deadline passing, a subscription expiring, a
reconciliation against an external system's view of the truth, a nightly rollup. The giveaway that
you need a schedule is that the trigger is the *absence* of something.

The rules for a scheduled tick:

- **A cron scans and dispatches; it does not do the work.** The tick finds candidates and enqueues
  one job each, so a slow item cannot make the tick overrun its own interval, and each item gets the
  queue's retry policy instead of dying with the tick.
- **The tick swallows its own errors after logging them.** A scheduler that dies on one bad run stops
  running entirely, and the failure is invisible until someone notices the absence of an effect.
  Swallowing is only safe because of the next rule.
- **A scheduled job is idempotent, so the next run heals a missed one.** "Expire everything whose
  deadline has passed and which is not yet expired" survives a skipped night; "expire everything that
  expired yesterday" does not.
- **Every interval and cron expression comes from configuration, never a literal**, and a cron
  carries an explicit time zone. 12-Factor's config-in-the-environment rule (factor III) applies to
  schedules exactly as it does to hostnames; an operator who cannot change a schedule without a
  deploy will instead change it by stopping the process.
- **Under multiple replicas, a schedule needs a lease.** Every instance's clock fires at the same
  second. A short-TTL lock (`SET key value PX ttl NX`, released in a `finally`) or an external
  scheduler that dispatches once is the difference between one run and N. Add jitter to any
  self-timed loop for the same reason.

## Long jobs are resumable, which means checkpointed

A job that takes minutes will be interrupted — a deploy, an eviction, a stalled lock. If the only
recovery is to start over, then every interruption repeats every side effect that already happened,
and long jobs become the thing everybody is afraid to retry.

The portable shape is Scheduler-Agent-Supervisor: split the work into steps, persist the completed
step, and let a retry resume from it. Here it is complete, because the detail that matters is which
line reads the row:

```ts
@Processor(queues[QueueName.RenderReport].name, {
    concurrency: envConfig().queue.renderReport.concurrency,   // bounded, from config
    lockDuration: envConfig().queue.lockDuration,
})
export class RenderReportWorker extends WorkerHost {
    async process(delivery: Job<string>): Promise<void> {
        let job = await this.jobs.get({ id: delivery.name })
        try {
            await this.jobs.markProcessing({ job })

            while (job.currentStep < job.maxSteps) {
                const step = this.steps.get(job.currentStep)
                if (!step) {
                    throw new StepNotFoundException({ stepIndex: job.currentStep })
                }
                await step.process({ job })
                // Re-read rather than incrementing in memory: the step committed its own
                // advance, and a previous attempt may have advanced further than this
                // process believes before it died.
                job = await this.jobs.get({ id: job.id })
            }

            await this.jobs.complete({ job })
        } catch (error) {
            await this.jobs.fail({ job, error: asError(error).message })
            throw error          // hands control to the queue's bounded retry and backoff
        }
    }
}
```

Each step must be individually idempotent, because the step that was interrupted mid-flight is the
one that will be replayed. A step whose work cannot be made idempotent should end by recording the
external identifier it produced, so the replay recognises its own earlier output rather than creating
a second one.

## Backpressure: bounded everywhere, or unbounded once

Queue-Based Load Levelling is the pattern that makes a queue useful as a shock absorber: the producer
writes at its own rate, the consumer works at its own rate, and the queue holds the difference. It
stops being an absorber and starts being a liability the moment nothing is bounded, because the
system then has no way to say no and fails by exhausting memory instead of by rejecting work.

- **Worker concurrency is set explicitly and comes from configuration.** Unbounded concurrency
  converts a queue backlog into a database connection-pool exhaustion, which takes the synchronous
  API down with it. This is Nygard's Bulkhead: give the background work its own bounded share of
  every contended resource, especially the connection pool.
- **No unbounded result set.** Nygard names this one directly. A sweeper that loads every candidate
  row will work for a year and then take the process down in one tick; page it, or cap it and let the
  next tick take the rest.
- **Every outbound call from a worker has a timeout.** A worker blocked forever on a socket holds its
  concurrency slot forever, so N such calls silently reduce throughput to zero while the process
  looks healthy.
- **Separate queues, not one queue with priorities in the payload.** A ten-second job and a
  ten-minute job in one queue means the fast work waits behind the slow work. Priority Queue in the
  Cloud Design Patterns catalogue is the pattern; separate queues with separate concurrency are the
  usual implementation and are easier to reason about.
- **Queue depth, oldest-message age and failure rate are monitored.** Depth alone is ambiguous — a
  deep queue that drains is fine. Oldest-message age is the signal that says work is not being done,
  and it is the one to alert on.

Whether a given backlog is a problem is judgement, and the honest way to settle it is an explicit
target: how stale is this job type allowed to be. Google's SRE Book calls that an SLO, and once it
exists the alert threshold stops being an argument.

## Sources

- Microsoft Cloud Design Patterns — Competing Consumers, Queue-Based Load Levelling, Async
  Request-Reply, Priority Queue, Scheduler-Agent-Supervisor.
- Michael Nygard, *Release It!* (2007, 2nd ed. 2018) — Bulkhead, Timeout, Unbounded Result Set.
- Marc Brooker, AWS Builders' Library, *Timeouts, retries, and backoff with jitter*; AWS Architecture
  Blog, *Exponential Backoff And Jitter* (2015).
- Gregor Hohpe and Bobby Woolf, *Enterprise Integration Patterns* (2003) — Dead Letter Channel.
- Google API Improvement Proposals, AIP-151 — long-running operations as resources.
- Stripe API reference — idempotency keys on unsafe requests.
- Adam Wiggins, *The Twelve-Factor App* (2011), factor III — config in the environment.
- Betsy Beyer et al., *Site Reliability Engineering* (2016) — the four golden signals, SLOs.

Related: `messaging-and-events.md` (idempotent consumers, which every rule above assumes),
`resilience.md` (the timeout, bulkhead and backoff rules, stated for the synchronous path) and
`cqrs-and-projections.md` (a projection rebuild is a background job with all of these properties).
