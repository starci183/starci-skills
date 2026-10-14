import type { EnvSource } from "@modules/platform/config"
import type { QueueOptions } from "./queue.options"

/** What the app's `main.ts` reads for the queues; the connections are the app root's choice. */
export type QueueConfig = Omit<QueueOptions, "connections">

/** Reads the queue options: pgmq lives in the primary Supabase PostgreSQL, so every value is a tunable with a literal default. */
export const parseQueueConfig = (env: EnvSource): QueueConfig => ({
    relayIntervalMs: env.duration("QUEUE_RELAY_INTERVAL", 1000),
    relayBatch: env.int("QUEUE_RELAY_BATCH", 50),
    concurrency: env.int("QUEUE_CONCURRENCY", 5),
    pollIntervalMs: env.duration("QUEUE_POLL_INTERVAL", 1000),
    visibilityTimeoutMs: env.duration("QUEUE_VISIBILITY_TIMEOUT", 30000),
})
