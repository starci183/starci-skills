import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectQueueTransport } from "./queue.decorators"
import type { QueueOutbox } from "./queue.port"
import type { QueueTransport } from "./queue-transport.port"
import { INSERT_QUEUE_ROW } from "./persistence/queue.sql"
import type { QueueRow } from "./persistence/queue.rows"

@Injectable()
/**
 * The writing side of the queues. pgmq lives in the same Supabase PostgreSQL as the business rows, so the job row of the outbox and
 * its pgmq message are both written in the caller's transaction: the job exists, and is already on its queue, exactly when the
 * change that needs it commits. The row is written as sent; the relay only picks up rows written without a send.
 */
export class QueueOutboxService implements QueueOutbox {
    constructor(
        @InjectQueueTransport() private readonly transport: QueueTransport,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Writes the job row and sends the message of the row the insert answered, both in the transaction `tx`. */
    async write(tx: EntityManager, queue: string, payload: object): Promise<void> {
        const rows: Array<QueueRow> = await tx.query(INSERT_QUEUE_ROW, [
            queue,
            JSON.stringify(payload),
            this.clock.now(),
        ])
        await eachInOrder(rows, (row) => this.transport.add(tx, row.queue, row.id, row.payload))
    }
}
