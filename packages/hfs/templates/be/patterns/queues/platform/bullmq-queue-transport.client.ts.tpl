import { Injectable } from "@nestjs/common"
import { InjectQueueFactory, InjectQueueOptions } from "./queue.decorators"
import type { QueueHandler, QueueSchedulerDefinition } from "./queue.contracts"
import type { QueueOptions } from "./queue.options"
import { ATTEMPTS, BACKOFF_MS, KEEP_COMPLETED_SECONDS, jobNameOf } from "./queue.policy"
import type { BullmqConnection, BullmqQueue, BullmqWorker, QueueFactory, QueueTransport } from "./queue-transport.port"

@Injectable()
/** The QueueTransport port over a Redis the app names in its options; the BullMQ objects come from the injected factory the module composes. */
export class BullmqQueueTransportClient implements QueueTransport {
    private readonly queues = new Map<string, BullmqQueue>()
    private readonly workers: Array<BullmqWorker> = []

    constructor(
        @InjectQueueOptions() private readonly options: QueueOptions,
        @InjectQueueFactory() private readonly factory: QueueFactory,
    ) {}

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
    work(handler: QueueHandler, concurrency: number): Promise<void> {
        this.workers.push(
            this.factory.worker(
                handler.queue,
                (job) =>
                    handler.handle({
                        id: job.id ?? "",
                        queue: handler.queue,
                        payload: job.data,
                        attempt: job.attemptsMade + 1,
                    }),
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
        await Promise.all(this.workers.map((worker) => worker.close(true)))
        await Promise.all([...this.queues.values()].map((queue) => queue.close()))
    }

    private connection(): BullmqConnection {
        return {
            prefix: this.options.prefix,
            connection: {
                host: this.options.redisHost,
                port: this.options.redisPort,
                db: this.options.redisDb,
                maxRetriesPerRequest: null,
            },
        }
    }

    private queueOf(name: string): BullmqQueue {
        const known = this.queues.get(name)
        if (known !== undefined) return known
        const created = this.factory.queue(name, this.connection())
        this.queues.set(name, created)
        return created
    }
}
