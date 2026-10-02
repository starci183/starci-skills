import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common"
import { Queue, Worker } from "bullmq"
import type { ConnectionOptions, Job } from "bullmq"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isRecord } from "@modules/platform/primitives"
import type { Probe } from "@modules/platform/probes"
import { MessagingError, MessagingErrorCode } from "./errors/messaging.error"
import type { DeadLetter, PublishedMessage, QueueSpec } from "./messaging.contracts"
import { InjectMessagingOptions } from "./messaging.decorators"
import { MessagingLogEvent } from "./messaging.log-events"
import type { MessagingOptions } from "./messaging.options"
import type { ConsumerRegistry, MessageConsumer, MessagePublisher } from "./messaging.port"

/** The data of one job: the stable event id and the payload the publisher gave. */
interface JobData {
    readonly eventId: string
    readonly payload: unknown
}

/** One registered consumer as the worker runs it: its queue and the delivery that parses the job and hands it over. */
interface RegisteredConsumer {
    readonly queue: QueueSpec
    readonly deliver: (job: Job) => Promise<void>
}

const jobDataOf = (value: unknown): JobData | null =>
    isRecord(value) && typeof value.eventId === "string" ? { eventId: value.eventId, payload: value.payload } : null

@Injectable()
/**
 * The BullMQ adapter of the messaging ports and the health probe of the queues; the only file that imports the queue
 * library. A queue is named by its event; a publication is one job with the attempts and the exponential backoff the queue
 * declares; a delivery that fails is delivered again after the backoff and, out of attempts, stays in the failed set of
 * its queue, which is the dead letters an operator reads.
 */
export class BullmqMessagingClient
    implements MessagePublisher, ConsumerRegistry, Probe, OnApplicationBootstrap, OnApplicationShutdown
{
    /** The name the health report lists this probe under. */
    readonly name = "messaging"

    private readonly queues = new Map<string, Queue>()
    private readonly consumers: Array<RegisteredConsumer> = []
    private readonly workers: Array<Worker> = []
    private started = false

    constructor(
        @InjectMessagingOptions() private readonly options: MessagingOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Appends the message to its queue as one job; the event id is the dedupe key of the receiver, not of the queue. */
    async publish<Payload extends object>(message: PublishedMessage<Payload>): Promise<void> {
        const { queue, eventId, payload } = message
        const data: JobData = { eventId, payload }
        await this.run(() =>
            this.queueOf(queue.name).add(queue.name, data, {
                attempts: queue.attempts,
                backoff: { type: "exponential", delay: queue.backoffMs },
                removeOnComplete: true,
                removeOnFail: false,
            }),
        )
    }

    /** The messages of the queue that ran out of attempts, oldest first. */
    async deadLetters(queue: QueueSpec): Promise<ReadonlyArray<DeadLetter>> {
        const failed = await this.run(() => this.queueOf(queue.name).getFailed())
        return failed.map((job) => ({
            id: job.id ?? "",
            eventId: jobDataOf(job.data)?.eventId ?? "",
            reason: job.failedReason,
            attempts: job.attemptsMade,
        }))
    }

    /** How many messages of the queue wait for the backoff of a failed delivery to pass. */
    async pendingRetries(queue: QueueSpec): Promise<number> {
        return this.run(() => this.queueOf(queue.name).getDelayedCount())
    }

    /** Puts a dead letter of the queue back to be delivered again; an id the queue no longer holds changes nothing. */
    async requeue(queue: QueueSpec, deadLetterId: string): Promise<void> {
        await this.run(async () => {
            const job = await this.queueOf(queue.name).getJob(deadLetterId)
            await job?.retry("failed")
        })
    }

    /** Registers the consumer of its queue; its worker starts when the app does, or at once when the app already runs. */
    add<Payload extends object>(consumer: MessageConsumer<Payload>): void {
        const registered: RegisteredConsumer = {
            queue: consumer.queue,
            deliver: async (job) => {
                const data = jobDataOf(job.data)
                const payload = data === null ? null : consumer.queue.parse(data.payload)
                if (data === null || payload === null) {
                    throw new MessagingError({
                        code: MessagingErrorCode.PayloadInvalid,
                        params: { queue: consumer.queue.name },
                    })
                }
                await consumer.handle({
                    id: job.id ?? "",
                    eventId: data.eventId,
                    payload,
                    attempt: job.attemptsMade + 1,
                })
            },
        }
        this.consumers.push(registered)
        if (this.started) this.workers.push(this.workerOf(registered))
    }

    /** Resolves when the queue store answers: reading whether a queue is paused is one round trip to it. */
    async check(): Promise<void> {
        await this.run(() => this.queueOf(this.name).isPaused())
    }

    /** Starts one worker per registered consumer. */
    onApplicationBootstrap(): void {
        this.started = true
        for (const consumer of this.consumers) this.workers.push(this.workerOf(consumer))
    }

    /** Stops the workers and closes every queue connection. */
    async onApplicationShutdown(): Promise<void> {
        await Promise.all([...this.workers, ...this.queues.values()].map((closable) => closable.close()))
    }

    private queueOf(name: string): Queue {
        const known = this.queues.get(name)
        if (known) return known
        const queue = new Queue(name, { connection: this.publisherConnection() })
        queue.on("error", (error) => this.logger.error(MessagingLogEvent.WorkerFailed, error, { queue: name }))
        this.queues.set(name, queue)
        return queue
    }

    private workerOf(consumer: RegisteredConsumer): Worker {
        const worker = new Worker(consumer.queue.name, (job) => consumer.deliver(job), {
            connection: this.workerConnection(),
            concurrency: this.options.concurrency,
        })
        worker.on("failed", (job, error) => this.account(consumer.queue, job, error))
        worker.on("error", (error) =>
            this.logger.error(MessagingLogEvent.WorkerFailed, error, { queue: consumer.queue.name }),
        )
        return worker
    }

    private account(queue: QueueSpec, job: Job | undefined, error: Error): void {
        const attempts = job?.attemptsMade ?? queue.attempts
        if (attempts >= queue.attempts) {
            this.logger.error(MessagingLogEvent.DeliveryBuried, error, { queue: queue.name, attempts })
            return
        }
        this.logger.warn(MessagingLogEvent.DeliveryRetried, {
            queue: queue.name,
            attempt: attempts,
            failure: `${error.name}: ${error.message}`,
        })
    }

    /** A publisher fails fast when the store is down, so the caller can decide; the options give the deadline. */
    private publisherConnection(): ConnectionOptions {
        return {
            url: this.options.url.reveal(),
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            commandTimeout: this.options.timeoutMs,
        }
    }

    /** A worker blocks on the store and waits for it to come back: the library requires no retry limit there. */
    private workerConnection(): ConnectionOptions {
        return { url: this.options.url.reveal(), maxRetriesPerRequest: null }
    }

    private async run<TResult>(command: () => Promise<TResult>): Promise<TResult> {
        try {
            return await command()
        } catch (cause) {
            throw new MessagingError({ code: MessagingErrorCode.Unavailable, cause })
        }
    }
}
