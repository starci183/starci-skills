import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { QueueHandler } from "./queue.contracts"
import { InjectQueueOptions } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import { backoffSecondsOf, deliveryOf, isExhausted, messageOf, secondsOf } from "./queue.policy"
import type { QueueTransport } from "./queue-transport.port"
import { PGMQ_ARCHIVE, PGMQ_READ, PGMQ_SEND, PGMQ_SET_VT } from "./persistence/queue.sql"
import type { PgmqMessageRow } from "./persistence/queue.rows"

@Injectable()
/**
 * The QueueTransport port over Supabase Queues (pgmq) in the primary PostgreSQL. A send runs on the caller's transaction; a worker
 * reads its queue with a visibility timeout, archives a message its handler completed, and on a failure makes the message visible
 * again after a backoff that doubles with the read count, archiving it once the read count reaches the attempt budget.
 */
export class PgmqQueueTransportClient implements QueueTransport {
    private running = true
    private readonly loops: Array<Promise<void>> = []

    constructor(
        @InjectQueueOptions() private readonly options: QueueOptions,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Sends the job inside the transaction `tx`, the outbox row id in the message. */
    async add(tx: EntityManager, queue: string, jobId: string, payload: object): Promise<void> {
        await tx.query(PGMQ_SEND, [queue, JSON.stringify(messageOf(jobId, payload))])
    }

    /** Starts the read loop of the handler's queue. */
    work(handler: QueueHandler, concurrency: number): Promise<void> {
        this.loops.push(this.poll(handler, concurrency))
        return Promise.resolve()
    }

    /** Resolves after `ms` milliseconds. */
    wait(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /** Stops every read loop and waits for the deliveries of its last pass. */
    async close(): Promise<void> {
        this.running = false
        await Promise.all(this.loops)
    }

    /** One pass, then the next, until the transport closes: each pass starts from the settled promise of the last. */
    private poll(handler: QueueHandler, concurrency: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const next = (): void => {
                if (!this.running) {
                    resolve()
                    return
                }
                void this.pass(handler, concurrency).then(next, reject)
            }
            next()
        })
    }

    /** Reads at most `concurrency` messages, runs them together, and pauses when the queue had none. */
    private async pass(handler: QueueHandler, concurrency: number): Promise<void> {
        const messages = await this.entityManager
            .query<Array<PgmqMessageRow>>(PGMQ_READ, [
                handler.queue,
                secondsOf(this.options.visibilityTimeoutMs),
                concurrency,
            ])
            .catch((cause: unknown) => {
                this.logger.error(QueueLogEvent.ReadFailed, cause, { queue: handler.queue })
                return []
            })
        await Promise.all(messages.map((message) => this.deliver(handler, message)))
        if (messages.length === 0 && this.running) await this.wait(this.options.pollIntervalMs)
    }

    /** Runs one message; a message that cannot be settled reappears after its visibility timeout. */
    private deliver(handler: QueueHandler, message: PgmqMessageRow): Promise<void> {
        return this.run(handler, message).catch((cause: unknown) => {
            this.logger.error(QueueLogEvent.SettleFailed, cause, { queue: handler.queue, messageId: message.msg_id })
        })
    }

    /** Archives a completed message; a failed one is logged and retried after its backoff, or archived after its last attempt. */
    private async run(handler: QueueHandler, message: PgmqMessageRow): Promise<void> {
        const exhausted = isExhausted(message.read_ct)
        try {
            await handler.handle(deliveryOf(handler.queue, message))
        } catch (cause) {
            this.logger.error(exhausted ? QueueLogEvent.DeadLettered : QueueLogEvent.DeliveryFailed, cause, {
                queue: handler.queue,
                messageId: message.msg_id,
                attempt: message.read_ct,
            })
            await (exhausted ? this.archive(handler.queue, message) : this.retryLater(handler.queue, message))
            return
        }
        await this.archive(handler.queue, message)
    }

    private async archive(queue: string, message: PgmqMessageRow): Promise<void> {
        await this.entityManager.query(PGMQ_ARCHIVE, [queue, message.msg_id])
    }

    /** Makes the message visible again after the backoff of its next attempt. */
    private async retryLater(queue: string, message: PgmqMessageRow): Promise<void> {
        await this.entityManager.query(PGMQ_SET_VT, [queue, message.msg_id, backoffSecondsOf(message.read_ct)])
    }
}
