import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { OutboxRelayPolicy } from "@modules/platform/outbox"
import { InjectQueueOptions, InjectQueueRelayManagers, InjectQueueTransport } from "./queue.decorators"
import type { QueueOptions } from "./queue.options"
import type { QueueTransport } from "./queue-transport.port"
import { MARK_ROWS_SENT, SELECT_WAITING_ROWS } from "./persistence/queue.sql"
import type { QueueRow } from "./persistence/queue.rows"

@Injectable()
/**
 * The relay of the queue outbox: it adds each waiting row to BullMQ with the row id as the job id and marks the rows sent in the same
 * transaction (the loop is `OutboxRelayPolicy`'s). A crash between the add and the mark adds the row again, which BullMQ ignores while
 * it holds the id and the job fence absorbs afterwards.
 */
export class QueueRelayService extends OutboxRelayPolicy<QueueRow> {
    protected readonly outbox = "queue"

    constructor(
        @InjectQueueOptions() private readonly options: QueueOptions,
        @InjectQueueRelayManagers() protected readonly managers: ReadonlyArray<EntityManager>,
        @InjectQueueTransport() private readonly transport: QueueTransport,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() protected readonly logger: Logger,
    ) {
        super()
    }

    protected select(tx: EntityManager): Promise<Array<QueueRow>> {
        return tx.query(SELECT_WAITING_ROWS, [this.options.relayBatch])
    }

    protected deliver(rows: ReadonlyArray<QueueRow>): Promise<void> {
        return eachInOrder(rows, (row) => this.transport.add(row.queue, row.id, row.payload))
    }

    protected async mark(tx: EntityManager, rows: ReadonlyArray<QueueRow>): Promise<void> {
        await tx.query(MARK_ROWS_SENT, [rows.map((row) => row.id), this.clock.now()])
    }

    protected idle(): Promise<void> {
        return this.transport.wait(this.options.relayIntervalMs)
    }
}
