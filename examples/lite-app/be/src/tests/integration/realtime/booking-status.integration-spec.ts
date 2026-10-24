import { bookingStatusTopic } from "@modules/domain/bookings"
import { createRealtimeProof, useTestWorld } from "../../world/kit"

const frameOf = (bookingId: string, status = "confirmed") => ({
    id: `${bookingId}:${status}`,
    bookingId,
    status,
})

/** The first line the stream writes: the subscription is registered in the hub before it is sent. */
const OPEN = ": open"

/**
 * realtime: the booking-status SSE door over the actual memory hub, default-deny guard and a real `text/event-stream` client on a
 * loopback port. The publisher is the hub call `BookingsService.confirmBooking` makes after its write (unit-specced there).
 */
describe("realtime: booking-status stream (integration)", () => {
    const world = useTestWorld({
        modules: () => createRealtimeProof(),
        cleanup: ({ close }) => close(),
    })

    it("realtime/subscriber-receives-push: a connected owner receives the status the hub is given after the confirmation", async () => {
        const { hub, open } = world.modules
        const stream = await open("token-person-1")
        await stream.readUntil(OPEN)

        hub.publish(bookingStatusTopic("person-1"), frameOf("b-1"))
        const received = await stream.readUntil("b-1:confirmed\n")

        expect(stream.status).toBe(200)
        expect(stream.headers.get("content-type")).toContain("text/event-stream")
        expect(stream.headers.get("x-accel-buffering")).toBe("no")
        expect(stream.headers.get("cache-control")).toContain("no-transform")
        expect(received).toContain("retry: 3000")
        expect(received).toContain('id: b-1:confirmed\ndata: {"id":"b-1:confirmed","bookingId":"b-1","status":"confirmed"}')
        stream.disconnect()
    })

    it("realtime/foreign-topic-is-isolated: another owner's stream never carries a status published to the first owner", async () => {
        const { hub, open } = world.modules
        const owner = await open("token-person-1")
        const other = await open("token-person-2")
        await owner.readUntil(OPEN)
        await other.readUntil(OPEN)

        hub.publish(bookingStatusTopic("person-1"), frameOf("b-owner"))
        hub.publish(bookingStatusTopic("person-2"), frameOf("b-other"))

        await owner.readUntil("id: b-owner:confirmed")
        const foreign = await other.readUntil("id: b-other:confirmed")
        expect(foreign).not.toContain("b-owner")
        owner.disconnect()
        other.disconnect()
    })

    it("realtime/disconnect-releases-subscription: after the client leaves the hub holds no subscription for it", async () => {
        const { hub, open, waitFor } = world.modules
        const topic = bookingStatusTopic("person-3")
        const before = hub.subscriberCount(topic)
        const stream = await open("token-person-3")
        await stream.readUntil(OPEN)
        expect(hub.subscriberCount(topic)).toBe(before + 1)

        stream.disconnect()

        await waitFor(() => hub.subscriberCount(topic) === before)
    })

    it("a reconnect with Last-Event-ID receives the frames it missed, then goes live", async () => {
        const { hub, open } = world.modules
        hub.publish(bookingStatusTopic("person-2"), frameOf("b-1", "pending"))
        hub.publish(bookingStatusTopic("person-2"), frameOf("b-1"))

        const resumed = await open("token-person-2", "b-1:pending")
        const received = await resumed.readUntil("id: b-1:confirmed")

        expect(received).not.toContain("id: b-1:pending")
        resumed.disconnect()
    })

    it("an unauthenticated or unknown token never opens the stream", async () => {
        const { open } = world.modules

        const anonymous = await open(undefined)
        const unknown = await open("token-nobody")

        expect(anonymous.status).not.toBe(200)
        expect(unknown.status).not.toBe(200)
        expect(anonymous.headers.get("content-type") ?? "").not.toContain("text/event-stream")
        anonymous.disconnect()
        unknown.disconnect()
    })
})
