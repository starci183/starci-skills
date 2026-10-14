import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The durable queue consumed by the deferred calendar delivery job. */
export const CALENDAR_DELIVERY_QUEUE = "calendar_delivery"

/** A committed receipt reference; the provider payload stays in the inbox. */
export interface CalendarDeliveryRecorded {
    /** The durable receipt to process after the intake commits. */
    readonly receiptId: string
}

/** Validates the queue message before the job resolves its committed receipt. */
export const isCalendarDeliveryRecorded = (value: unknown): value is CalendarDeliveryRecorded =>
    typeof value === "object" &&
    value !== null &&
    "receiptId" in value &&
    typeof value.receiptId === "string" &&
    value.receiptId.trim().length > 0

@Injectable()
/** The typed producer that publishes a receipt exactly when its intake transaction commits. */
export class CalendarDeliveryQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Writes the receipt reference to the queue outbox using the receipt transaction manager. */
    enqueueDeliveryRecorded(message: CalendarDeliveryRecorded, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, CALENDAR_DELIVERY_QUEUE, message)
    }
}
