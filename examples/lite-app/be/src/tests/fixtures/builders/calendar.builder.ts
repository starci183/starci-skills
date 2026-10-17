import type { CalendarReceiptIdsRow } from "@modules/domain/calendar-inbox"
import { QueueInspectionClient } from "@modules/platform/queue"
import { DELETE_CALENDAR_CLAIM } from "@modules/platform/inbox"
import { READ_CALENDAR_RECEIPT_IDS, DELETE_CALENDAR_RECEIPTS } from "@modules/domain/calendar-inbox"
import type { EntityManager } from "typeorm"
import { CALENDAR_DELIVERY_QUEUE } from "@modules/queues/calendar-delivery"
import { DELETE_CALENDAR_OUTBOX } from "@modules/platform/queue"

/** Removes only the delivery and its handoff rows, including after a failed proof. */
export const createCalendarBuilder = (manager: EntityManager) => ({
    async cleanup(deliveryId: string): Promise<void> {
        const [receipts] = await manager.query<Array<CalendarReceiptIdsRow>>(READ_CALENDAR_RECEIPT_IDS, [
            "calendar",
            deliveryId,
        ])
        const ids = receipts?.ids ?? []
        await new QueueInspectionClient().cleanup(manager, CALENDAR_DELIVERY_QUEUE, (row) =>
            ids.includes(String(row.message.payload.receiptId)),
        )
        await manager.query(DELETE_CALENDAR_OUTBOX, [CALENDAR_DELIVERY_QUEUE, ids])
        await manager.query(DELETE_CALENDAR_RECEIPTS, ["calendar", deliveryId])
        await manager.query(DELETE_CALENDAR_CLAIM, [deliveryId])
    },
})
