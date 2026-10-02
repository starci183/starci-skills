import type { EnvSource } from "@modules/platform/config"
import type { QueueOptions } from "./queue.options"

/** What the app's `main.ts` reads for the queues; the connections and the schedulers are the app root's choice. */
export type QueueConfig = Omit<QueueOptions, "connections" | "schedulers">

/** Reads the queue options: the Redis address is required, the rest are tunables with literal defaults. */
export const parseQueueConfig = (env: EnvSource): QueueConfig => ({
    redisHost: env.string("QUEUE_REDIS_HOST"),
    redisPort: env.int("QUEUE_REDIS_PORT", 6379),
    prefix: env.optional("QUEUE_PREFIX") ?? "queue",
    relayIntervalMs: env.duration("QUEUE_RELAY_INTERVAL", 200),
    relayBatch: env.int("QUEUE_RELAY_BATCH", 50),
    concurrency: env.int("QUEUE_CONCURRENCY", 5),
})
