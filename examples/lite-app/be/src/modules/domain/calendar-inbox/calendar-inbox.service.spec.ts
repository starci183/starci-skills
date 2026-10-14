import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { CalendarsService } from "@modules/domain/calendars"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { CalendarDeliveryQueue } from "@modules/queues/calendar-delivery"
import { CalendarInboxService } from "./calendar-inbox.service"
import {
    COMPLETE_CALENDAR_INBOX,
    FIND_PENDING_CALENDAR_INBOX,
    INSERT_CALENDAR_INBOX,
} from "./persistence/calendar-inbox.sql"

interface PendingCalendarReceipt {
    readonly id: string
    readonly payload: { readonly id: string }
}

const build = async (
    claimed: ReadonlyArray<{ id: string }> = [],
    pending: ReadonlyArray<PendingCalendarReceipt> = [],
) => {
    const tx = fakeTransaction(
        mockEntityManager({
            query: [
                [INSERT_CALENDAR_INBOX, claimed],
                [FIND_PENDING_CALENDAR_INBOX, pending],
                [FIND_PENDING_CALENDAR_INBOX, []],
                [COMPLETE_CALENDAR_INBOX, [{ id: "inbox-1" }]],
            ],
        }),
    )
    const calendars = mock<CalendarsService>()
    calendars.acceptCalendarDelivery.mockResolvedValue(undefined)
    const queue = mock<CalendarDeliveryQueue>()
    queue.enqueueDeliveryRecorded.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            CalendarInboxService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CalendarDeliveryQueue, useValue: queue },
            { provide: CalendarsService, useValue: calendars },
        ],
    }).compile()
    return { inbox: moduleRef.get(CalendarInboxService), tx, calendars, queue }
}

describe("CalendarInboxService.acceptCalendarDelivery", () => {
    it("records the receipt and queues its identity together before committing", async () => {
        const { inbox, tx, calendars, queue } = await build([{ id: "inbox-1" }])
        let commitsAtEnqueue = -1
        queue.enqueueDeliveryRecorded.mockImplementation(async () => {
            commitsAtEnqueue = tx.commits
        })

        await inbox.acceptCalendarDelivery("delivery-1", { id: "calendar-1" })

        expect(tx.commits).toBe(1)
        expect(commitsAtEnqueue).toBe(0)
        expect(tx.em.query).toHaveBeenCalledWith(INSERT_CALENDAR_INBOX, [
            "calendar",
            "delivery-1",
            JSON.stringify({ id: "calendar-1" }),
        ])
        expect(tx.em.query).toHaveBeenCalledTimes(1)
        expect(queue.enqueueDeliveryRecorded).toHaveBeenCalledWith({ receiptId: "inbox-1" }, expect.any(Object))
        expect(queue.enqueueDeliveryRecorded.mock.calls[0]?.[1]).not.toBe(tx.em)
        expect(calendars.acceptCalendarDelivery).not.toHaveBeenCalled()
    })

    it("acknowledges a duplicate without queuing or processing it again", async () => {
        const { inbox, tx, calendars, queue } = await build()

        await inbox.acceptCalendarDelivery("delivery-1", { id: "calendar-1" })

        expect(tx.commits).toBe(1)
        expect(tx.em.query).toHaveBeenCalledTimes(1)
        expect(queue.enqueueDeliveryRecorded).not.toHaveBeenCalled()
        expect(calendars.acceptCalendarDelivery).not.toHaveBeenCalled()
    })

    it("rolls the receipt back when its durable handoff fails", async () => {
        const { inbox, tx, calendars, queue } = await build([{ id: "inbox-1" }])
        const failure = new TypeError("queue unavailable")
        queue.enqueueDeliveryRecorded.mockRejectedValue(failure)

        await expect(inbox.acceptCalendarDelivery("delivery-1", { id: "calendar-1" })).rejects.toBe(failure)

        expect(tx.rollbacks).toBe(1)
        expect(tx.committedWrites).toEqual([])
        expect(tx.rolledBackWrites).toHaveLength(1)
        expect(tx.em.query).toHaveBeenCalledTimes(1)
        expect(calendars.acceptCalendarDelivery).not.toHaveBeenCalled()
    })
})

describe("CalendarInboxService.processCalendarDelivery", () => {
    it("loads the pending receipt and processes its payload before completing it", async () => {
        const receipt = { id: "inbox-1", payload: { id: "calendar-1" } }
        const { inbox, tx, calendars, queue } = await build([], [receipt])

        await inbox.processCalendarDelivery("inbox-1")

        expect(tx.commits).toBe(1)
        expect(tx.em.query).toHaveBeenNthCalledWith(1, FIND_PENDING_CALENDAR_INBOX, ["inbox-1"])
        expect(calendars.acceptCalendarDelivery).toHaveBeenCalledWith(receipt.payload, expect.any(Object))
        expect(calendars.acceptCalendarDelivery.mock.calls[0]?.[1]).not.toBe(tx.em)
        expect(tx.em.query).toHaveBeenNthCalledWith(2, COMPLETE_CALENDAR_INBOX, ["inbox-1"])
        expect(queue.enqueueDeliveryRecorded).not.toHaveBeenCalled()
    })

    it("acknowledges a missing receipt without running the domain work", async () => {
        const { inbox, tx, calendars, queue } = await build()

        await inbox.processCalendarDelivery("inbox-1")

        expect(tx.commits).toBe(1)
        expect(tx.em.query).toHaveBeenCalledTimes(1)
        expect(tx.em.query).toHaveBeenCalledWith(FIND_PENDING_CALENDAR_INBOX, ["inbox-1"])
        expect(calendars.acceptCalendarDelivery).not.toHaveBeenCalled()
        expect(queue.enqueueDeliveryRecorded).not.toHaveBeenCalled()
    })

    it("acknowledges a completed receipt replay without repeating its effect", async () => {
        const receipt = { id: "inbox-1", payload: { id: "calendar-1" } }
        const { inbox, tx, calendars } = await build([], [receipt])

        await inbox.processCalendarDelivery("inbox-1")
        await inbox.processCalendarDelivery("inbox-1")

        expect(tx.commits).toBe(2)
        expect(calendars.acceptCalendarDelivery).toHaveBeenCalledTimes(1)
        expect(tx.em.query).toHaveBeenCalledTimes(3)
        expect(tx.em.query).toHaveBeenLastCalledWith(FIND_PENDING_CALENDAR_INBOX, ["inbox-1"])
    })

    it("leaves the receipt pending when the domain work fails", async () => {
        const receipt = { id: "inbox-1", payload: { id: "calendar-1" } }
        const { inbox, tx, calendars } = await build([], [receipt])
        const failure = new TypeError("calendar intake failed")
        calendars.acceptCalendarDelivery.mockRejectedValue(failure)

        await expect(inbox.processCalendarDelivery("inbox-1")).rejects.toBe(failure)

        expect(tx.rollbacks).toBe(1)
        expect(tx.committedWrites).toEqual([])
        expect(tx.em.query).toHaveBeenCalledTimes(1)
        expect(tx.em.query).toHaveBeenCalledWith(FIND_PENDING_CALENDAR_INBOX, ["inbox-1"])
    })
})

describe("CalendarInboxService.processRecordedDelivery", () => {
    it("resolves a valid queued receipt reference through the pending inbox", async () => {
        const receipt = { id: "inbox-1", payload: { id: "calendar-1" } }
        const { inbox, tx, calendars } = await build([], [receipt])

        await inbox.processRecordedDelivery({ receiptId: "inbox-1" })

        expect(tx.commits).toBe(1)
        expect(tx.em.query).toHaveBeenCalledWith(FIND_PENDING_CALENDAR_INBOX, ["inbox-1"])
        expect(calendars.acceptCalendarDelivery).toHaveBeenCalledWith(receipt.payload, expect.any(Object))
    })

    it.each([{ receiptId: "" }, { receiptId: "   " }, { receiptId: 7 }, {}])(
        "acknowledges a malformed queue message (%p) without opening a transaction",
        async (message) => {
            const { inbox, tx, calendars } = await build()

            await inbox.processRecordedDelivery(message)

            expect(tx.outcomes).toEqual([])
            expect(tx.em.query).not.toHaveBeenCalled()
            expect(calendars.acceptCalendarDelivery).not.toHaveBeenCalled()
        },
    )
})
