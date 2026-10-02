import { Injectable } from "@nestjs/common"
import { Queue, Worker } from "bullmq"
import { InjectQueueOptions } from "./queue.decorators"
import type { QueueHandler, QueueSchedulerDefinition } from "./queue.contracts"
import type { QueueOptions } from "./queue.options"
import { ATTEMPTS, BACKOFF_MS, KEEP_COMPLETED_SECONDS, jobNameOf } from "./queue.policy"
import type { QueueTransport } from "./queue-transport.port"

@Injectable()
/** The one importer of BullMQ: the QueueTransport port over a Redis the app names in its options. */
export class BullmqQueueTransportClient implements QueueTransport {
    private readonly queues = new Map<string, Queue>()
    private readonly workers: Array<Worker> = []

    constructor(@InjectQueueOptions() private readonly options: QueueOptions) {}

    /** Adds the job with the outbox row id as its BullMQ id, so adding it twice leaves one job. */
    async add(queue: string, jobId: string, payload: object): Promise<void> {
        await this.queueOf(queue).add(jobNameOf(queue), payload, {
            jobId,
            attempts: ATTEMPTS,
            backoff: { type: "exponential", delay: BACKOFF_MS },
            removeOnComplete: { age: KEEP_COMPLETED_SECONDS },
        })
    }

    /** Creates or updates the scheduler; BullMQ keeps one per id however many replicas call this. */
    async upsertScheduler(scheduler: QueueSchedulerDefinition): Promise<void> {
        await this.queueOf(scheduler.queue).upsertJobScheduler(
            scheduler.id,
            { every: scheduler.everyMs },
            { name: jobNameOf(scheduler.queue), data: scheduler.payload ?? {}, opts: { attempts: ATTEMPTS } },
        )
    }

    /** Starts a worker of the queue. */
    work(queue: string, handler: QueueHandler, concurrency: number): Promise<void> {
        this.workers.push(
            new Worker(
                queue,
                (job) =>
                    handler({ id: job.id ?? "", queue, payload: job.data as object, attempt: job.attemptsMade + 1 }),
                { ...this.connection(), concurrency },
            ),
        )
        return Promise.resolve()
    }

    /** Resolves after `ms` milliseconds. */
    wait(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /** Closes the workers first, then the queues. */
    async close(): Promise<void> {
        await Promise.all(this.workers.map((worker) => worker.close()))
        await Promise.all([...this.queues.values()].map((queue) => queue.close()))
    }

    private connection() {
        return {
            prefix: this.options.prefix,
            connection: { host: this.options.redisHost, port: this.options.redisPort, maxRetriesPerRequest: null },
        }
    }

    private queueOf(name: string): Queue {
        const known = this.queues.get(name)
        if (known !== undefined) return known
        const created = new Queue(name, this.connection())
        this.queues.set(name, created)
        return created
    }
}
