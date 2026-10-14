import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { BaseEvent, EventEnvelope } from "./event-bus.contracts"
import type { EventBus } from "./event-bus.port"
import { INSERT_OUTBOX_EVENT } from "./persistence/event-bus.sql"

@Injectable()
/** Writes a receipt event into the same transaction as its inbox receipt, without running any consumer. */
export class EventBusService implements EventBus {
    /** The outbox commits or rolls back with the receipt; only a later reactor or job processes it. */
    async publish(event: BaseEvent, tx: EntityManager): Promise<void> {
        const envelope: EventEnvelope = { eventId: event.eventId, eventName: event.eventName, payload: event.payload }
        await tx.query(INSERT_OUTBOX_EVENT, [event.eventId, event.eventName, JSON.stringify(envelope)])
    }
}
