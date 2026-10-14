import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import type { MockEntityManager, RecordingQueueOutbox } from "@starci/jest-preset"
import { ResourcesService } from "@modules/domain/resources"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { BOOKING_CONFIRMATION_QUEUE, BookingConfirmationQueue } from "@modules/queues/booking-confirmation"
import { BOOKING_REMINDER_QUEUE, BookingReminderQueue } from "@modules/queues/booking-reminder"
import type { CreateBookingParams } from "./bookings.contracts"
import { BookingsService } from "./bookings.service"
import { BookingsErrorCode } from "./errors/bookings.error"
import { CONFIRM_BOOKING, FIND_BOOKING_STATUS, INSERT_BOOKING, REMIND_BOOKING, REMIND_DUE_BOOKINGS } from "./persistence/bookings.sql"

const paramsOf = builder<CreateBookingParams>({
    resourceId: "resource-1",
    startsAt: "2026-10-13T10:00:00.000Z",
    endsAt: "2026-10-13T11:00:00.000Z",
})

const INSERTED = {
    id: "booking-1",
    resource_id: "resource-1",
    starts_at: "2026-10-13T10:00:00.000Z",
    ends_at: "2026-10-13T11:00:00.000Z",
    status: "pending",
}

const build = async (entityManager: MockEntityManager) => {
    const resources = mock<ResourcesService>()
    resources.resources.mockResolvedValue({ id: "resource-1" })
    const outbox: RecordingQueueOutbox = recordingQueueOutbox()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingsService,
            BookingConfirmationQueue,
            BookingReminderQueue,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: ResourcesService, useValue: resources },
            { provide: QUEUE_OUTBOX, useValue: outbox },
        ],
    }).compile()
    return { bookings: moduleRef.get(BookingsService), resources, outbox }
}

describe("BookingsService", () => {
    describe("createBooking", () => {
        it("writes the pending booking and enqueues its confirmation and reminder in the same transaction", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_BOOKING, [INSERTED]] }))
            const { bookings, resources, outbox } = await build(tx.em)

            await expect(bookings.createBooking("person-1", paramsOf())).resolves.toEqual({
                id: "booking-1",
                resourceId: "resource-1",
                startsAt: "2026-10-13T10:00:00.000Z",
                endsAt: "2026-10-13T11:00:00.000Z",
                status: "pending",
            })

            expect(resources.resources).toHaveBeenCalledWith("person-1", "resource-1")
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_BOOKING, [
                "person-1",
                "resource-1",
                "2026-10-13T10:00:00.000Z",
                "2026-10-13T11:00:00.000Z",
            ])
            expect(outbox.jobsOf(BOOKING_CONFIRMATION_QUEUE)).toEqual([
                { queue: BOOKING_CONFIRMATION_QUEUE, payload: { bookingId: "booking-1" } },
            ])
            expect(outbox.jobsOf(BOOKING_REMINDER_QUEUE)).toEqual([
                { queue: BOOKING_REMINDER_QUEUE, payload: { bookingId: "booking-1" } },
            ])
            expect(outbox.allInTransaction).toBe(true)
            expect(tx.commits).toBe(1)
        })

        it("writes nothing for a resource the caller does not own", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const { bookings, resources, outbox } = await build(tx.em)
            const notFound = new Error("RESOURCES_NOT_FOUND")
            resources.resources.mockRejectedValue(notFound)

            await expect(bookings.createBooking("person-1", paramsOf())).rejects.toBe(notFound)

            expect(tx.outcomes).toEqual([])
            expect(outbox.jobs).toEqual([])
        })

        it("refuses an interval that overlaps another booking of the resource and enqueues nothing", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_BOOKING, []] }))
            const overlap = Object.assign(new Error("conflicting key value violates exclusion constraint"), {
                code: "23P01",
            })
            tx.em.query.mockRejectedValueOnce(overlap)
            const { bookings, outbox } = await build(tx.em)

            await expect(bookings.createBooking("person-1", paramsOf())).rejects.toMatchObject({
                code: BookingsErrorCode.IntervalTaken,
                params: { resourceId: "resource-1" },
            })

            expect(tx.rollbacks).toBe(1)
            expect(outbox.jobs).toEqual([])
        })

        it("rethrows any other database failure as it is", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_BOOKING, []] }))
            const failure = new Error("connection lost")
            tx.em.query.mockRejectedValueOnce(failure)
            const { bookings } = await build(tx.em)

            await expect(bookings.createBooking("person-1", paramsOf())).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
        })

        it("refuses when the insert answers no row", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_BOOKING, []] }))
            const { bookings, outbox } = await build(tx.em)

            await expect(bookings.createBooking("person-1", paramsOf())).rejects.toMatchObject({
                code: BookingsErrorCode.NotCreated,
            })

            expect(outbox.jobs).toEqual([])
        })

        it("rolls the booking back when its confirmation cannot be enqueued", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_BOOKING, [INSERTED]] }))
            const { bookings, outbox } = await build(tx.em)
            const failure = new Error("queue missing")
            outbox.failNext("write", failure)

            await expect(bookings.createBooking("person-1", paramsOf())).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
            expect(tx.committedWrites).toEqual([])
        })
    })

    describe("bookingStatus", () => {
        it("answers the status of a booking the principal owns", async () => {
            const em = mockEntityManager({ query: [FIND_BOOKING_STATUS, [{ id: "booking-1", status: "confirmed" }]] })
            const { bookings } = await build(em)

            await expect(bookings.bookingStatus("person-1", "booking-1")).resolves.toEqual({
                id: "booking-1",
                status: "confirmed",
            })
            expect(em.query).toHaveBeenCalledWith(FIND_BOOKING_STATUS, ["booking-1", "person-1"])
        })

        it("answers not found for a booking that is absent or owned by someone else", async () => {
            const em = mockEntityManager({ query: [FIND_BOOKING_STATUS, []] })
            const { bookings } = await build(em)

            await expect(bookings.bookingStatus("person-1", "booking-9")).rejects.toMatchObject({
                code: BookingsErrorCode.NotFound,
                params: { id: "booking-9" },
            })
        })
    })

    describe("confirmBooking", () => {
        it("confirms the pending booking the job names", async () => {
            const em = mockEntityManager({ query: [CONFIRM_BOOKING, []] })
            const { bookings } = await build(em)

            await bookings.confirmBooking({ bookingId: "booking-1" })

            expect(em.query).toHaveBeenCalledWith(CONFIRM_BOOKING, ["booking-1"])
        })

        it("changes nothing for a payload that is not a confirm-booking payload", async () => {
            const em = mockEntityManager()
            const { bookings } = await build(em)

            await bookings.confirmBooking({ orderId: "order-1" })

            expect(em.query).not.toHaveBeenCalled()
        })
    })

    describe("remindBooking", () => {
        it("marks the reminder of the booking the job names", async () => {
            const em = mockEntityManager({ query: [REMIND_BOOKING, []] })
            const { bookings } = await build(em)

            await bookings.remindBooking({ bookingId: "booking-1" })

            expect(em.query).toHaveBeenCalledWith(REMIND_BOOKING, ["booking-1"])
        })

        it("runs the due-bookings catch-up of a pg_cron tick", async () => {
            const em = mockEntityManager({ query: [REMIND_DUE_BOOKINGS, []] })
            const { bookings } = await build(em)

            await bookings.remindBooking({ tick: true })

            expect(em.query).toHaveBeenCalledWith(REMIND_DUE_BOOKINGS)
        })

        it("changes nothing for a payload that is neither a booking reminder nor a tick", async () => {
            const em = mockEntityManager()
            const { bookings } = await build(em)

            await bookings.remindBooking({ orderId: "order-1" })

            expect(em.query).not.toHaveBeenCalled()
        })
    })
})
