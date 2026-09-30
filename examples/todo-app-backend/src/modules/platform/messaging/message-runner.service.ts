import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectOutbox } from "@modules/platform/outbox"
import type { Outbox, OutboxRecord } from "@modules/platform/outbox"
import { MessagingError, MessagingErrorCode } from "./errors/messaging.error"
import type { ConsumedMessage } from "./messaging.contracts"
import { InjectMessagingOptions } from "./messaging.decorators"
import { MessagingLogEvent } from "./messaging.log-events"
import type { MessagingOptions } from "./messaging.options"
import type { ConsumerRegistry, MessageConsumer } from "./messaging.port"
import { backoffDelayMs } from "./queue.policy"

interface RegisteredConsumer {
    readonly attempts: number
    readonly backoffMs: number
    readonly deliver: (record: OutboxRecord) => Promise<void>
}

const describeFailure = (error: unknown): string =>
    error instanceof Error ? `${error.name}: ${error.message}` : String(error)

@Injectable()
/**
 * The consumer registry and the poll loop of a worker: it claims due messages of the registered queues from the outbox
 * store, hands each to its consumer, completes it on success, and reschedules or buries it on failure. An app that
 * registers no consumer never polls.
 */
export class MessageRunnerService implements ConsumerRegistry, OnApplicationBootstrap, OnApplicationShutdown {
    private readonly consumers = new Map<string, RegisteredConsumer>()
    private timer: NodeJS.Timeout | undefined
    private stopped = false

    constructor(
        @InjectMessagingOptions() private readonly options: MessagingOptions,
        @InjectOutbox() private readonly outbox: Outbox,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Registers the consumer of its queue. */
    add<Payload extends object>(consumer: MessageConsumer<Payload>): void {
        this.consumers.set(consumer.queue.name, {
            attempts: consumer.queue.attempts,
            backoffMs: consumer.queue.backoffMs,
            deliver: async (record) => {
                const payload = consumer.queue.parse(record.payload)
                if (payload === null) {
                    throw new MessagingError({
                        code: MessagingErrorCode.PayloadInvalid,
                        params: { queue: record.queue },
                    })
                }
                const message: ConsumedMessage<Payload> = {
                    id: record.id,
                    eventId: record.eventId,
                    payload,
                    attempt: record.attempts,
                }
                await consumer.handle(message)
            },
        })
    }

    /** Starts polling when at least one consumer is registered. */
    onApplicationBootstrap(): void {
        if (this.consumers.size > 0) this.schedule()
    }

    /** Stops polling. */
    onApplicationShutdown(): void {
        this.stopped = true
        if (this.timer) clearTimeout(this.timer)
    }

    /** Claims and delivers one batch of due messages. */
    async drain(): Promise<void> {
        const records = await this.outbox.claimDue({
            at: this.clock.now(),
            queues: [...this.consumers.keys()],
            limit: this.options.batchSize,
            visibilityMs: this.options.visibilityMs,
        })
        for (const record of records) {
            await this.deliver(record)
        }
    }

    private schedule(): void {
        this.timer = setTimeout(() => void this.poll(), this.options.pollMs)
    }

    private async poll(): Promise<void> {
        try {
            await this.drain()
        } catch (error) {
            this.logger.error(MessagingLogEvent.PollFailed, error)
        } finally {
            if (!this.stopped) this.schedule()
        }
    }

    private async deliver(record: OutboxRecord): Promise<void> {
        const consumer = this.consumers.get(record.queue)
        if (!consumer) return
        try {
            await consumer.deliver(record)
            await this.outbox.complete(record.id)
        } catch (error) {
            const failure = describeFailure(error)
            if (record.attempts >= consumer.attempts) {
                await this.outbox.bury({ id: record.id, error: failure })
                this.logger.error(MessagingLogEvent.DeliveryBuried, error, {
                    queue: record.queue,
                    attempts: record.attempts,
                })
                return
            }
            const at = new Date(this.clock.now().getTime() + backoffDelayMs(consumer, record.attempts))
            await this.outbox.retry({ id: record.id, at, error: failure })
            this.logger.warn(MessagingLogEvent.DeliveryRetried, {
                queue: record.queue,
                attempt: record.attempts,
                failure,
            })
        }
    }
}
