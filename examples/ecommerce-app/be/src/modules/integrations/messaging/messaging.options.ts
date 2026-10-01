import type { Secret } from "@modules/platform/config"

/** Options of the messaging capability: where the queues live and how a worker consumes them. */
export interface MessagingOptions {
    /** The Redis URL of the queues; it may embed credentials. */
    readonly url: Secret
    /** How long one Redis command of a publisher waits for its answer before it fails as unavailable, in milliseconds. */
    readonly timeoutMs: number
    /** How many messages one consumer handles at the same time. */
    readonly concurrency: number
}
