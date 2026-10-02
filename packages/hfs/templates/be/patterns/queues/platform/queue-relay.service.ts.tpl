import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PassLoop } from "@modules/platform/primitives"
import { InjectQueueOptions, InjectQueueRelayManagers, InjectQueueTransport } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import type { QueueTransport } from "./queue-transport.port"
import { MARK_ROWS_SENT, SELECT_WAITING_ROWS } from "./persistence/queue.sql"
import type { QueueRow } from "./persistence/queue.rows"

@Injectable()
/**
 * The relay of the queue outbox: it reads the rows that wait on each connection of the app, in the order they were written, adds
 * each to BullMQ with the row id as the job id and marks the rows sent in the same transaction. A row that is not committed is not
 * visible to the relay, so nothing starts for a rolled-back change; a crash between the add and the mark adds the row again, which
 * BullMQ ignores while it holds the id and the job fence absorbs afterwards. The loop runs from the start of the app to its
 * shutdown and pauses only when the outbox is empty.
 */
export class QueueRelayService implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly loop: PassLoop

    constructor(
        @InjectQueueOptions() private readonly options: QueueOptions,
        @InjectQueueRelayManagers() private readonly managers: ReadonlyArray<EntityManager>,
        @InjectQueueTransport() private readonly transport: QueueTransport,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {
        this.loop = new PassLoop({
            pass: () => this.relay(),
            onFailure: (cause) => this.logger.error(QueueLogEvent.RelayFailed, cause),
            wait: (ms) => this.transport.wait(ms),
            idleMs: this.options.relayIntervalMs,
        })
    }

    /** One pass over every connection: adds the oldest waiting rows of each (at most the batch size) and answers how many it added. */
    async relay(): Promise<number> {
        let added = 0
        for (const manager of this.managers) added += await this.relayOf(manager)
        return added
    }

    /** Starts the relay loop over the outbox of every connection the options name. */
    onApplicationBootstrap(): void {
        this.loop.start()
    }

    /** Stops the loop and waits for its last pass. */
    async onApplicationShutdown(): Promise<void> {
        await this.loop.stop()
    }

    private relayOf(manager: EntityManager): Promise<number> {
        return manager.transaction(async (tx) => {
            const rows: Array<QueueRow> = await tx.query(SELECT_WAITING_ROWS, [this.options.relayBatch])
            if (rows.length === 0) return 0
            for (const row of rows) await this.transport.add(row.queue, row.id, row.payload)
            await tx.query(MARK_ROWS_SENT, [rows.map((row) => row.id), this.clock.now()])
            return rows.length
        })
    }

}
