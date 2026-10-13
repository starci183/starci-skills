import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OutboxRelayPolicy } from "@modules/platform/outbox"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectQueueOptions, InjectQueueRelayManagers, InjectQueueTransport } from "./queue.decorators"
import type { QueueOptions } from "./queue.options"
import type { QueueTransport } from "./queue-transport.port"
import { MARK_ROWS_SENT, SELECT_WAITING_ROWS } from "./persistence/queue.sql"
import type { QueueRow } from "./persistence/queue.rows"

@Injectable()
/**
 * The relay of the queue outbox: it sends each row that waits to pgmq with the row id as the job id and marks the rows sent, all in
 * one transaction (the loop is `OutboxRelayPolicy`'s). A producer's write already sends its job, so the relay only carries rows a
 * SQL-side writer left unsent; since pgmq shares the database, a row is sent and marked together or not at all.
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

    protected deliver(tx: EntityManager, rows: ReadonlyArray<QueueRow>): Promise<void> {
        return eachInOrder(rows, (row) => this.transport.add(tx, row.queue, row.id, row.payload))
    }

    protected async mark(tx: EntityManager, rows: ReadonlyArray<QueueRow>): Promise<void> {
        await tx.query(MARK_ROWS_SENT, [rows.map((row) => row.id), this.clock.now()])
    }

    protected idle(): Promise<void> {
        return this.transport.wait(this.options.relayIntervalMs)
    }
}
