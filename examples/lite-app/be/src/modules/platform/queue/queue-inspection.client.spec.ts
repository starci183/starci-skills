import { mockEntityManager } from "@starci/jest-preset"
import { QueueInspectionClient } from "./queue-inspection.client"
import { PGMQ_DELETE, PGMQ_READ } from "./persistence/queue.sql"

describe("QueueInspectionClient cleanup", () => {
    it("removes every matching proof delivery while preserving other bookings and scheduler ticks", async () => {
        const manager = mockEntityManager({
            query: [
                [
                    PGMQ_READ,
                    [
                        { msg_id: "1", message: { payload: { bookingId: "proof" } } },
                        { msg_id: "2", message: { payload: { bookingId: "other" } } },
                        { msg_id: "3", message: { payload: { tick: true } } },
                        { msg_id: "4", message: { payload: { bookingId: "proof" } } },
                    ],
                ],
                [PGMQ_DELETE, [{ deleted: true }]],
            ],
        })

        await new QueueInspectionClient().cleanup(
            manager,
            "booking_reminder",
            (row) => row.message.payload.bookingId === "proof",
        )

        const deleted = manager.query.mock.calls.filter(([query]) => query === PGMQ_DELETE)
        expect(deleted).toEqual([
            [PGMQ_DELETE, ["booking_reminder", "1"]],
            [PGMQ_DELETE, ["booking_reminder", "4"]],
        ])
    })
})
