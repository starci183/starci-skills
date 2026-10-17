import type { EntityManager } from "typeorm"
import { CALENDAR_DELIVERY_QUEUE } from "@modules/queues/calendar-delivery"
import {
    READ_CALENDAR_RECEIPT_IDS,
    DELETE_CALENDAR_MESSAGES,
    DELETE_CALENDAR_OUTBOX,
    DELETE_CALENDAR_RECEIPTS,
    DELETE_CALENDAR_CLAIM,
} from "@modules/platform/queue"
import type { CalendarReceiptIdsRow } from "@modules/platform/queue"

/** Removes only the delivery and its handoff rows, including after a failed proof. */
export const createCalendarBuilder = (manager: EntityManager) => ({
    async cleanup(deliveryId: string): Promise<void> {
        const [receipts] = await manager.query<Array<CalendarReceiptIdsRow>>(READ_CALENDAR_RECEIPT_IDS, [
            "calendar",
            deliveryId,
        ])
        const ids = receipts?.ids ?? []
        await manager.query(DELETE_CALENDAR_MESSAGES, [ids])
        await manager.query(DELETE_CALENDAR_OUTBOX, [CALENDAR_DELIVERY_QUEUE, ids])
        await manager.query(DELETE_CALENDAR_RECEIPTS, ["calendar", deliveryId])
        await manager.query(DELETE_CALENDAR_CLAIM, [deliveryId])
    },
})
