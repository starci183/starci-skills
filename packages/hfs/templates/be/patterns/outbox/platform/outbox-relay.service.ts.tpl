import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { Logger } from "@modules/platform/logging"
import { OutboxLogEvent } from "./outbox.log-events"

/**
 * The relay of an outbox: the one loop the event bus and the queues share. It reads the rows that wait on each connection of the app,
 * in the order they were written, hands them over and marks them sent in the same transaction. A row that is not committed is not
 * visible to the relay, so nothing leaves for a rolled-back change; a crash between the delivery and the mark delivers the row again,
 * which the receiver absorbs. The loop runs from the start of the app to its shutdown and pauses only when the outbox is empty.
 * A concrete relay says how a batch is read, delivered and marked, which outbox it is and how it waits.
 */
export abstract class OutboxRelayService<Row extends { readonly id: string }>
    implements OnApplicationBootstrap, OnApplicationShutdown
{
    private running = false
    private loop: Promise<void> = Promise.resolve()

    /** The entity managers of the connections that hold an outbox, read in this order. */
    protected abstract readonly managers: ReadonlyArray<EntityManager>

    /** Where a failed pass is logged. */
    protected abstract readonly logger: Logger

    /** The name of the outbox this relay serves, written into the log line of a failed pass. */
    protected abstract readonly outbox: string

    /** One pass over every connection: relays the oldest waiting rows of each and answers how many it relayed. */
    async relay(): Promise<number> {
        let relayed = 0
        for (const manager of this.managers) relayed += await this.relayOf(manager)
        return relayed
    }

    /** Starts the relay loop over the outbox of every connection. */
    onApplicationBootstrap(): void {
        this.running = true
        this.loop = this.run()
    }

    /** Stops the loop and waits for its last pass. */
    async onApplicationShutdown(): Promise<void> {
        this.running = false
        await this.loop
    }

    /** Reads and locks the oldest rows that wait, at most one batch; a second relay skips the rows this one holds. */
    protected abstract select(tx: EntityManager): Promise<Array<Row>>

    /** Hands the rows over; a throw rolls the transaction back, so the rows stay waiting. */
    protected abstract deliver(rows: ReadonlyArray<Row>): Promise<void>

    /** Marks the rows as handed over, in the transaction that read them. */
    protected abstract mark(tx: EntityManager, rows: ReadonlyArray<Row>): Promise<void>

    /** Waits before the next pass over an empty outbox. */
    protected abstract idle(): Promise<void>

    private relayOf(manager: EntityManager): Promise<number> {
        return manager.transaction(async (tx) => {
            const rows = await this.select(tx)
            if (rows.length === 0) return 0
            await this.deliver(rows)
            await this.mark(tx, rows)
            return rows.length
        })
    }

    private async run(): Promise<void> {
        while (this.running) {
            const relayed = await this.relay().catch((cause: unknown) => {
                this.logger.error(OutboxLogEvent.RelayFailed, cause, { outbox: this.outbox })
                return 0
            })
            if (relayed === 0 && this.running) await this.idle()
        }
    }
}
