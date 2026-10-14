import type { InjectionToken } from "@nestjs/common"

/** What the queues of one app need: how the relay and the workers run, and which connection holds the outbox and pgmq. */
export interface QueueOptions {
    /** The pause between two relay passes over an empty outbox. */
    readonly relayIntervalMs: number
    /** The most outbox rows one relay pass sends. */
    readonly relayBatch: number
    /** How many messages one worker of the app reads and runs at once. */
    readonly concurrency: number
    /** The pause of a worker after a read that found no message. */
    readonly pollIntervalMs: number
    /** How long a read message stays hidden from other readers; a worker that dies mid-job lets it reappear after this. */
    readonly visibilityTimeoutMs: number
    /** The tokens of the shared entity managers of the connections that hold a queue outbox of the app: the relay reads each of them. pgmq itself lives in the primary Supabase PostgreSQL. */
    readonly connections: ReadonlyArray<InjectionToken>
}
