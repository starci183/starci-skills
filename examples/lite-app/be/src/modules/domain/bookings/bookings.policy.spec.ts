import { Test } from "@nestjs/testing"
import { bookingStatusFrame, bookingStatusTopic, isBookingStatusFrame } from "./bookings.policy"

const SUBJECT: unique symbol = Symbol("bookings.policy")

const buildSubject = async () => {
    const functions = { bookingStatusFrame, bookingStatusTopic, isBookingStatusFrame }
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => functions }],
    }).compile()
    return moduleRef.get<typeof functions>(SUBJECT)
}

const FRAME = { id: "b-1:confirmed", bookingId: "b-1", status: "confirmed" }

describe("booking status policy", () => {
    describe("bookingStatusFrame", () => {
        it("names the event after the booking and the status, so a repeated job pushes the same id", async () => {
            const subject = await buildSubject()

            expect(subject.bookingStatusFrame("b-1", "confirmed")).toEqual(FRAME)
            expect(subject.bookingStatusFrame("b-1", "confirmed")).toEqual(subject.bookingStatusFrame("b-1", "confirmed"))
            expect(subject.bookingStatusFrame("b-1", "reminded").id).not.toBe(FRAME.id)
        })
    })

    describe("isBookingStatusFrame", () => {
        it("accepts a frame with an event id, a booking and a status", async () => {
            const subject = await buildSubject()

            expect(subject.isBookingStatusFrame(FRAME)).toBe(true)
        })

        it.each([
            ["a string", "frame"],
            ["null", null],
            ["an object without an id", { bookingId: "b-1", status: "confirmed" }],
            ["an id that is not text", { ...FRAME, id: 1 }],
            ["an object without a booking", { id: "b-1:confirmed", status: "confirmed" }],
            ["a booking that is not text", { ...FRAME, bookingId: 1 }],
            ["an object without a status", { id: "b-1:confirmed", bookingId: "b-1" }],
            ["a status that is not text", { ...FRAME, status: 1 }],
        ])("refuses %s", async (_label, value) => {
            const subject = await buildSubject()

            expect(subject.isBookingStatusFrame(value)).toBe(false)
        })
    })

    describe("bookingStatusTopic", () => {
        it("puts the owner in the channel name so another principal's channel is another topic", async () => {
            const subject = await buildSubject()

            expect(subject.bookingStatusTopic("person-1").name).toBe("booking-status:person-1")
            expect(subject.bookingStatusTopic("person-2").name).not.toBe(subject.bookingStatusTopic("person-1").name)
        })

        it("accepts only booking status frames", async () => {
            const subject = await buildSubject()
            const topic = subject.bookingStatusTopic("person-1")

            expect(topic.accepts(FRAME)).toBe(true)
            expect(topic.accepts({ orderId: "o-1" })).toBe(false)
        })
    })
})
