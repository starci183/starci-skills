# Async and messaging — queues, events, schedules (the REAL idiom)

Scope: how this repo writes **background asynchronous code** — BullMQ (queue, worker, step), NATS
with EventEmitter2 (events), `@Cron` and `@Interval` (schedules), a Redis lock (coalescing), and
`async`/`await` discipline inside services. Grounded entirely in `src/`, with no outside theory
applied.

The real stack: `bullmq` with `@nestjs/bullmq` for queues, `nats` with `EventEmitter2` for the dual
bus, `ioredis` for locks and cache, `@nestjs/schedule` for `@Cron` and `@Interval`, and `superjson`
for payload serialisation. There is no Kafka in `src/` — that lives in CDC infrastructure outside the
repo.

---

## 1. A queue name ALWAYS comes from `bullData[BullQueueName.X].name` — never a literal

Every queue is named centrally in `src/modules/bullmq/constants/queue.ts`. Injecting a queue and
registering a worker both point there rather than typing a string.

```ts
// src/modules/bussiness/jobs/enqueue/process-git-submission.service.ts
@InjectQueue(bullData[BullQueueName.ProcessGitSubmission].name)
private readonly processGitSubmissionV2Queue: Queue<string>,
```

```ts
// src/features/api/processors/ai/generate-cv/enqueue-generate-cv.service.ts
// Known debt, flagged in the code itself:
// TODO(wire): swap the literal for
// `@InjectQueue(bullData[BullQueueName.GenerateCv].name)`.
@InjectQueue("generate-cv")
private readonly generateCvQueue: Queue<string>,
```

Adding a queue means adding an entry to `bullData` — with the `formatWithBraces` prefix that pins the
Redis slot — and a value to the `BullQueueName` enum FIRST, and only then injecting it.

A payload crossing the queue boundary is ALWAYS a `string`, so the types are `Queue<string>` and
`Job<string>`, never `Queue<MyPayload>`.

---

## 2. Enqueue is: tracked row FIRST, `add` fire-and-forget, with a failure fallback

Every `enqueue/*.service.ts` follows the same shape: (1) persist the `jobs` row, and any business row,
FIRST; (2) `void sleepEnqueueUxDelay().then(() => queue.add(...)).catch(...)` — do NOT `await` the
`add`; return the job immediately; (3) the `.catch` marks the job `Failed` when the broker is down.

```ts
// src/modules/bussiness/jobs/enqueue/process-git-submission.service.ts
const job = await this.jobActionService.createJob({ /* … */ payload: this.superJson.stringify(payloadBody) })
void sleepEnqueueUxDelay().then(() =>
    this.processGitSubmissionV2Queue.add(job.id, job.payload, { jobId: job.id }),
).catch((error) =>
    this.jobActionService.failJob({ job, error: `Failed to enqueue job to broker: ${error?.message ?? "unknown error"}` }),
)
```

```ts
// Wrong: awaiting the add blocks the response for no reason
await this.queue.add(job.id, job.payload)
// Wrong: a floating promise with no void and no catch — a broker failure is swallowed
this.queue.add(job.id, job.payload)
```

Passing `jobId: job.id` in the options lets BullMQ deduplicate on an id we control, which makes a
requeue idempotent. The delay comes from `sleepEnqueueUxDelay()`
(`src/modules/bussiness/jobs/utils/enqueue-ux-delay.ts`) — do not hand-roll a `setTimeout`.

---

## 3. Payloads crossing a queue are serialised with SuperJSON, not `JSON.stringify`

A payload can contain `Date`, `BigInt`, and similar, so `superjson` is injected through
`@InjectSuperJson()`. Call `stringify` when enqueueing and `parse<T>()` inside the worker.

```ts
// enqueue side: superJson.stringify(payloadBody)
// worker side: src/features/api/processors/ai/generate-cv/generate-cv.worker.ts
payload = this.superJson.parse<GenerateCvPayload>(bullmqJob.data)
```

Build the payload with **conditional spread** so an `undefined` key disappears entirely and the
serialised string stays tight:

```ts
...(branch !== undefined ? { branch } : {}),
```

---

## 4. A worker is `WorkerHost` plus `@Processor`, with one `process()` wrapped in try/catch

A worker extends `WorkerHost` and is decorated with `@Processor` (aliased in this repo as
`Processor as Worker`), taking its concurrency and lock settings from `envConfig().bullmq.*`. The
body of `process()` is wrapped in try/catch: mark it processing, run, then `completeJob` and a
structured Winston log; on catch, mark it `Failed`, log, and **rethrow** so BullMQ retries with
backoff.

```ts
// src/features/api/processors/ai/generate-cv/generate-cv.worker.ts
@Worker(GENERATE_CV_QUEUE_NAME, {
    concurrency: envConfig().bullmq.aiConcurrency,
    lockDuration: envConfig().bullmq.lockDuration,
    stalledInterval: envConfig().bullmq.stalledInterval,
    maxStalledCount: envConfig().bullmq.maxStalledCount,
})
export class GenerateCvWorker extends WorkerHost {
    async process(bullmqJob: Job<string>) {
        try { /* … */ await this.jobActionService.completeJob({ job }) }
        catch (error) { /* markFailed + winston */ throw error }   // rethrow → retry
    }
}
```

Retry and backoff are NOT hand-written in the worker; they are configured centrally in
`BullModule.registerQueue` (`removeOnComplete/Fail: true`, `attempts`,
`backoff: { type: "exponential", delay }`). The rethrow is what triggers them.

---

## 5. A multi-step pipeline is a `Map<number, AbstractStepService>` driven by a `while` loop

A long job is split into steps: each step is a service extending
`AbstractStepService<Payload, Extended>` (`src/modules/bussiness/jobs/types/context.ts`), collected
into a `Map` keyed by `stepIndex` in `step-mapping.service.ts`. The worker loops
`while (job.currentStep < job.maxSteps)`, **re-fetching the job each pass**, then calls
`step.process(context)`.

```ts
// generate-cv.worker.ts
while (job.currentStep < job.maxSteps) {
    const syncedJob = await this.jobActionService.getJob({ id: job.id })
    job = syncedJob; context.job = job
    const step = stepMap.get(syncedJob.currentStep)
    if (!step) { throw new StepNotFoundException({ stepIndex: syncedJob.currentStep }) }
    await step.process(context)
}
```

A missing step or row throws its own `AbstractException` — `StepNotFoundException`,
`CvGenerationNotFoundException` — never a bare `Error`.

---

## 6. Events go through `EventEmitterService.emit`, never straight to EventEmitter2 or NATS

The dual bus — a local `EventEmitter2` plus `NatsProducerService` — is hidden behind
`EventEmitterService` (`src/modules/event/event-emitter.service.ts`), which picks the channel from
`useLocal` / `useNats` in `configMap[event]`. Do not call `nc.publish` or `eventEmitter.emit`
anywhere else.

```ts
// emitting
await this.eventEmitterService.emit({ event: EventName.ChallengeSubmissionProgressUpdated, args, payload })
```

```ts
// subscribing, in onModuleInit
// src/features/api/core/graphql/queries/challenges/challenge-submission-progress/challenge-submission-progress.listener.ts
export class ChallengeSubmissionProgressListener implements OnModuleInit {
    onModuleInit(): void {
        this.eventEmitterService.on({
            event: EventName.ChallengeSubmissionProgressUpdated,
            listener: async (payload: ChallengeSubmissionProgressUpdatedEventPayload) => { /* … */ },
        })
    }
}
```

There is real debt still sitting in `event-emitter.service.ts` — a `console.log` of the payload in
the emit path. Do not multiply it:

```ts
if (useNats) {
    console.log({ eventName, payload })   // use WinstonService or Logger, never console.log
```

Logging in a background path is `WinstonService.log(WinstonLog.X, {...})` or
`new Logger(Class.name)` — structured, never `console.*`.

---

## 7. Schedules are `@Cron` and `@Interval`, with a try/catch that swallows (and idempotent work)

Periodic work uses the `@nestjs/schedule` decorators. `@Cron` ALWAYS carries a `name` and
`timeZone: "Asia/Ho_Chi_Minh"`. The handler body wraps itself in a try/catch that **logs and
swallows** — one bad run must not crash the scheduler — and the job must be idempotent so tomorrow's
run heals it.

```ts
// src/modules/bussiness/installment-plan/installment-plan-enforcement.cron.ts
@Cron(CronExpression.EVERY_DAY_AT_1AM, { name: "installment-plan-enforcement", timeZone: "Asia/Ho_Chi_Minh" })
async enforceOverduePlans(): Promise<void> {
    try { /* find candidates → handle each → log */ }
    catch (error) {
        const cause = error instanceof Error ? error : new Error(String(error))
        this.logger.error(cause.message, cause.stack)   // log and swallow
    }
}
```

A short technical cycle uses `@Interval(envConfig().nats.ping.interval)`
(`src/modules/event/nats/producer.service.ts`) — the interval comes from env, never a hard-coded
number.

Heavy work discovered by a cron is **enqueued** for a worker; do not do it inside the tick. A cron
scans and dispatches.

---

## 8. Use the shared `sleep` helper; coalesce with a Redis `SET NX` and a poll

A deliberate wait is `sleep(ms)` from `@modules/common` (`src/modules/common/utils/sleep.ts`) — do
not scatter `new Promise(setTimeout)` around. To stop a storm of duplicate requests across
instances, take a Redis lock with `SET … PX … NX`, poll for the result, and
`finally { del(lockKey) }`.

```ts
// src/features/api/core/graphql/mutations/keycloak/refresh-token/refresh-token-coalescer.service.ts
const acquired = await this.redis.set(lockKey, "1", "PX", REFRESH_LOCK_TTL_MS, "NX")
if (acquired) { return this.exchangeAndPublish({ refreshToken, resultKey, lockKey }) }
// otherwise wait for the lock holder to publish; on timeout, exchange anyway — correctness beats dedup
```

The lock is ALWAYS released in a `finally`, and the `PX` TTL is the safety valve for a holder that
dies. Every time constant (`*_TTL_MS`, `*_INTERVAL_MS`) lives in `constants/`, never as a magic
number.

---

## 9. Promise discipline — no floating promises

- Deliberate fire-and-forget is **always** `void promise.then(...).catch(...)` (§2). Never leave a
  promise floating bare.
- A known number of parallel calls is `Promise.all([...])`; when you need every result even if one
  fails, `Promise.allSettled` — used deliberately, and rarely. A sequential loop that needs ordering
  or wants to limit database pressure is `for … of` with `await` (as the cron in §7 walks
  `duePlans`), never `forEach(async …)`.
- Every async public method declares its `Promise<T>` explicitly (matching `type-safety.md`); do not
  let a boundary infer `Promise<void>`.
