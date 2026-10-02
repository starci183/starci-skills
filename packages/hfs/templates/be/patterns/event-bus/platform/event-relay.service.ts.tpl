import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectEventBusOptions, InjectEventRelayManagers, InjectEventTransport } from "./event-bus.decorators"
import { EventBusLogEvent } from "./event-bus.log-events"
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
 * The relay of the outbox: it reads the rows that wait on each connection of the app, in the order they were written, hands them
 * to the broker and marks them sent in the same transaction. A row that is not committed is not visible to the relay, so nothing
 * leaves for a rolled-back change; a crash between the send and the mark sends the row again, which the consumers absorb
 * through their inbox. The loop runs from the start of the app to its shutdown and pauses only when the outbox is empty.
 */
export class EventRelayService implements OnApplicationBootstrap, OnApplicationShutdown {
    private running = false
    private loop: Promise<void> = Promise.resolve()

    constructor(
        @InjectEventBusOptions() private readonly options: EventBusOptions,
        @InjectEventRelayManagers() private readonly managers: ReadonlyArray<EntityManager>,
        @InjectEventTransport() private readonly transport: EventTransport,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** One pass over every connection: sends the oldest waiting rows of each (at most the batch size) and answers how many it sent. */
    async relay(): Promise<number> {
        let sent = 0
        for (const manager of this.managers) sent += await this.relayOf(manager)
        return sent
    }

    /** Starts the relay loop over the outbox of every connection the options name. */
    onApplicationBootstrap(): void {
        this.running = true
        this.loop = this.run()
    }

    /** Stops the loop and waits for its last pass. */
    async onApplicationShutdown(): Promise<void> {
        this.running = false
        await this.loop
    }

    private relayOf(manager: EntityManager): Promise<number> {
        return manager.transaction(async (tx) => {
            const rows: Array<OutboxRow> = await tx.query(SELECT_WAITING_ROWS, [this.options.relayBatch])
            if (rows.length === 0) return 0
            await this.transport.send(rows.map(messageOf))
            await tx.query(MARK_ROWS_SENT, [rows.map((row) => row.id), this.clock.now()])
            return rows.length
        })
    }

    private async run(): Promise<void> {
        while (this.running) {
            const sent = await this.relay().catch((cause: unknown) => {
                this.logger.error(EventBusLogEvent.RelayFailed, cause)
                return 0
            })
            if (sent === 0 && this.running) await this.transport.wait(this.options.relayIntervalMs)
        }
    }
}
