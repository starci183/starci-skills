# Concept — Background jobs (BullMQ processors)

Source: `src/features/api/processors/`, `src/modules/bullmq/`.

A business processor lives at `src/features/api/processors/<name>/`. The second location this rule
used to name — `src/features/synchronizer/processors/sync-<name>/` — no longer exists: re-checked
2026-08-03, `src/features/` holds `api/ backup/ cli/ mock/ socketio/ tools/ video-encoder/`, and the
startup synchronizers now sit under `src/modules/init/synchronizers/` (see
[`init-v2-and-seeders.md`](init-v2-and-seeders.md)).

## The shape of one processor folder

`<name>.processor.ts` — `@Processor(BullMQQueue.X)`, `extends WorkerHost`, overriding `process(job)`
— plus `<name>.service.ts` holding the actual logic, `dto/` typing the payload, and `index.ts`.
Register it by adding the provider to `processors.module.ts`; the core app turns the set on with
`ApiModule.register({ useProcessors: true })`.

The business processors present, re-counted 2026-08-03: `ai`, `enroll`, `judge-coding-submission`,
`reconcile-transaction`, `resolve-github`, `revoke-github`, `send-mail`.

## Enqueue through the wrapper, from an event handler

Jobs are enqueued through a service wrapper in `@modules/bussiness` — `EnqueueSendMailJobService
.enqueue(payload)` is the pattern — and the call usually comes from a
[`cqrs-commands-events.md`](cqrs-commands-events.md) handler rather than from the code that caused
the event. The event decouples the cause from the job; calling the processor directly puts them back
together.

## Video encoding is not a separate app

It runs inside the `core` app, at `src/features/video-encoder/processors/video-encoder/`. See
[`media-dash-ffmpeg.md`](media-dash-ffmpeg.md).

## Cron and interval

A fixed schedule uses `@Cron(envConfig().X.cron)`. A job that polls something external prefers
`setTimeout` with random jitter, then `setInterval`, started in `OnModuleInit` — the jitter is there
to stop every instance waking at the same second. Either way the value comes from `envConfig()` (see
[`config-and-env.md`](config-and-env.md)); an interval is never hardcoded.
