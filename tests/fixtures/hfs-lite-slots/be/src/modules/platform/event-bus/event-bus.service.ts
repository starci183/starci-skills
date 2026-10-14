import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BaseEvent, EventEnvelope, EventQueueRoute } from "./event-bus.contracts"
import type { EventBus, EventConsumer } from "./event-bus.port"
import type { EventOutboxRow, EventQueueRow } from "./persistence/event-bus.rows"
import {
    ARCHIVE_EVENT, DELETE_EVENT, DELETE_OUTBOX_EVENT, INSERT_OUTBOX_EVENT,
    READ_EVENTS, READ_OUTBOX_EVENTS, SEND_EVENT,
} from "./persistence/event-bus.sql"

@Injectable()
/** A Supabase pgmq adapter: atomic outbox fanout, leased consumption and archived dead letters. */
export class EventBusService implements EventBus {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** No queue send or consumer runs inside the domain transaction. */
    async publish(event: BaseEvent, tx: EntityManager): Promise<void> {
        const envelope: EventEnvelope = { eventId: event.eventId, eventName: event.eventName, payload: event.payload }
        await tx.query(INSERT_OUTBOX_EVENT, [event.eventId, event.eventName, JSON.stringify(envelope)])
    }

    /** A failure rolls back every send and leaves the outbox row for the next relay tick. */
    async relay(routes: ReadonlyArray<EventQueueRoute>): Promise<void> {
        await this.entityManager.transaction(async (tx) => {
            const rows = await tx.query<ReadonlyArray<EventOutboxRow>>(READ_OUTBOX_EVENTS)
            for (const row of rows) {
                const destinations = routes.filter((route) => route.eventName === row.event_name)
                if (destinations.length === 0) continue
                for (const route of destinations) {
                    await tx.query(SEND_EVENT, [route.queue, JSON.stringify(row.payload)])
                }
                await tx.query(DELETE_OUTBOX_EVENT, [row.event_id])
            }
        })
    }

    /** A thrown handler leaves the leased message untouched; its next read follows the visibility timeout. */
    async consume<Event extends BaseEvent>(queue: string, consumer: EventConsumer<Event>, visibilitySeconds = 30, budget = 3): Promise<void> {
        const rows = await this.entityManager.query<ReadonlyArray<EventQueueRow>>(READ_EVENTS, [queue, visibilitySeconds])
        for (const row of rows) {
            const event = consumer.event.parse(row.message)
            if (row.read_ct > budget || event === null) {
                await this.entityManager.query(ARCHIVE_EVENT, [queue, row.msg_id])
                continue
            }
            await consumer.handle({ eventId: event.eventId, event, attempt: row.read_ct })
            await this.entityManager.query(DELETE_EVENT, [queue, row.msg_id])
        }
    }
}
