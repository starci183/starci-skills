import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OutboxRelayPolicy } from "@modules/platform/outbox"
import { InjectEventBusOptions, InjectEventRelayManagers, InjectEventTransport } from "./event-bus.decorators"
import type { EventBusOptions } from "./event-bus.options"
import type { EventTransport, OutboundMessage } from "./event-transport.port"
import { MARK_ROWS_SENT, SELECT_WAITING_ROWS } from "./persistence/event-bus.sql"
import type { OutboxRow } from "./persistence/event-bus.rows"

/** The message the broker receives for one outbox row. */
const messageOf = (row: OutboxRow): OutboundMessage => ({
    topic: row.topic,
    key: row.message_key,
    value: JSON.stringify(row.envelope),
    headers: {},
})

@Injectable()
/**
 * The relay of the event outbox: it hands the waiting rows of each connection to the broker and marks them sent in the same
 * transaction (the loop is `OutboxRelayPolicy`'s). A crash between the send and the mark sends the row again, which the consumers
 * absorb through their inbox.
 */
export class EventRelayService extends OutboxRelayPolicy<OutboxRow> {
    protected readonly outbox = "event-bus"

    constructor(
        @InjectEventBusOptions() private readonly options: EventBusOptions,
        @InjectEventRelayManagers() protected readonly managers: ReadonlyArray<EntityManager>,
        @InjectEventTransport() private readonly transport: EventTransport,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() protected readonly logger: Logger,
    ) {
        super()
    }

    protected select(tx: EntityManager): Promise<Array<OutboxRow>> {
        return tx.query(SELECT_WAITING_ROWS, [this.options.relayBatch])
    }

    protected deliver(rows: ReadonlyArray<OutboxRow>): Promise<void> {
        return this.transport.send(rows.map(messageOf))
    }

    protected async mark(tx: EntityManager, rows: ReadonlyArray<OutboxRow>): Promise<void> {
        await tx.query(MARK_ROWS_SENT, [rows.map((row) => row.id), this.clock.now()])
    }

    protected idle(): Promise<void> {
        return this.transport.wait(this.options.relayIntervalMs)
    }
}
