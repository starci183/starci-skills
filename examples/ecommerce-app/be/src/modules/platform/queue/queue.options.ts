import type { InjectionToken } from "@nestjs/common"
import type { QueueSchedulerDefinition } from "./queue.contracts"

/** What the queues of one app need: where Redis is, how the relay and the workers run, which connections hold an outbox, and the schedulers it registers. */
export interface QueueOptions {
    /** The Redis host BullMQ talks to. */
    readonly redisHost: string
    /** The Redis port. */
    readonly redisPort: number
    /** The Redis database that holds this app's queue state. */
    readonly redisDb: number
    /** What every BullMQ key starts with: the shared default in a deployment, the run prefix of a test world. */
    readonly prefix: string
    /** The pause between two relay passes over an empty outbox. */
    readonly relayIntervalMs: number
    /** The most outbox rows one relay pass hands to BullMQ. */
    readonly relayBatch: number
    /** How many jobs one worker of the app runs at once. */
    readonly concurrency: number
    /** The tokens of the shared entity managers of the connections that hold a queue outbox of the app: the relay reads each of them. */
    readonly connections: ReadonlyArray<InjectionToken>
    /** The job schedulers the app registers at boot; BullMQ upserts them by id, so a pool of replicas fires each one once per interval. */
    readonly schedulers: ReadonlyArray<QueueSchedulerDefinition>
}
