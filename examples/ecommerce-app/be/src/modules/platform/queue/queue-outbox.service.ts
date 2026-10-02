import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { QueueOutbox } from "./queue.port"
import { INSERT_QUEUE_ROW } from "./persistence/queue.sql"

@Injectable()
/** The writing side of the queues: a job is a row of the outbox of the caller's transaction, so it exists exactly when the change that needs it commits. */
export class QueueOutboxService implements QueueOutbox {
    constructor(@InjectClock() private readonly clock: Clock) {}

    /** Writes the job in the outbox of the transaction `tx`; the relay adds it to BullMQ after the commit. */
    async write(tx: EntityManager, queue: string, payload: object): Promise<void> {
        await tx.query(INSERT_QUEUE_ROW, [queue, JSON.stringify(payload), this.clock.now()])
    }
}
