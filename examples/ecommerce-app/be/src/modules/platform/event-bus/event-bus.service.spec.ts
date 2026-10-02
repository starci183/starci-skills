import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { CONSUMER_REGISTRY, MESSAGE_PUBLISHER } from "@modules/platform/messaging"
import type { ConsumerRegistry, MessageConsumer, MessagePublisher } from "@modules/platform/messaging"
import { EventBusErrorCode } from "./errors/event-bus.error"
import { BaseEvent } from "./event-bus.contracts"
import type { EventConsumer } from "./event-bus.port"
import { EventBusService } from "./event-bus.service"

class PingEvent extends BaseEvent {
    static readonly eventName = "probe.ping"
    static readonly version = 1

    readonly eventName = PingEvent.eventName

    constructor(
        readonly eventId: string,
        readonly payload: { readonly note: string },
    ) {
        super()
    }

    static parse(envelope: unknown): PingEvent | null {
        return typeof envelope === "object" &&
            envelope !== null &&
            "eventId" in envelope &&
            typeof envelope.eventId === "string" &&
            "payload" in envelope &&
            typeof envelope.payload === "object" &&
            envelope.payload !== null &&
            "note" in envelope.payload &&
            typeof envelope.payload.note === "string"
            ? new PingEvent(envelope.eventId, { note: envelope.payload.note })
            : null
    }
}

const QUEUE = { name: "probe.ping", attempts: 3, backoffMs: 1000 }

const build = async () => {
    const messages = mock<MessagePublisher>()
    const registry = mock<ConsumerRegistry>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            EventBusService,
            { provide: MESSAGE_PUBLISHER, useValue: messages },
            { provide: CONSUMER_REGISTRY, useValue: registry },
        ],
    }).compile()
    return { bus: moduleRef.get(EventBusService), messages, registry }
}

/** Registers a consumer of `PingEvent` and answers what the queue worker would be given. */
const registered = async (handle: EventConsumer<PingEvent>["handle"]) => {
    const { bus, registry } = await build()
    let captured: MessageConsumer<object> | undefined
    registry.add.mockImplementation((consumer) => {
        captured = consumer
    })
    bus.add({ event: PingEvent, handle })
    if (captured === undefined) throw new Error("the consumer was not registered")
    return captured
}

describe("EventBusService", () => {
    describe("publish", () => {
        it("publishes the event on the queue named after it, with its event id as the dedupe key", async () => {
            const { bus, messages } = await build()

            await bus.publish(new PingEvent("e-1", { note: "hi" }), mockEntityManager())

            expect(messages.publish).toHaveBeenCalledWith({ queue: QUEUE, eventId: "e-1", payload: { note: "hi" } })
        })
    })

    describe("operator reads", () => {
        it("counts the events of a class waiting for a retry", async () => {
            const { bus, messages } = await build()
            messages.pendingRetries.mockResolvedValue(2)

            expect(await bus.pendingRetries(PingEvent)).toBe(2)

            expect(messages.pendingRetries).toHaveBeenCalledWith(QUEUE)
        })

        it("lists the dead letters of a class with ids that name the event", async () => {
            const { bus, messages } = await build()
            messages.deadLetters.mockResolvedValue([{ id: "7", eventId: "e-1", reason: "refused", attempts: 3 }])

            expect(await bus.deadLetters(PingEvent)).toEqual([
                { id: "probe.ping|7", eventName: "probe.ping", eventId: "e-1", reason: "refused", attempts: 3 },
            ])
        })

        it("requeues a dead letter on the queue its id names", async () => {
            const { bus, messages } = await build()

            await bus.requeue("probe.ping|7")

            expect(messages.requeue).toHaveBeenCalledWith(QUEUE, "7")
        })
    })

    describe("add", () => {
        it("registers the consumer on the queue named after its event and hands each message over as a delivery", async () => {
            const handle = jest.fn(() => Promise.resolve())
            const consumer = await registered(handle)

            expect(consumer.queue.name).toBe("probe.ping")
            await consumer.handle({ id: "j-1", eventId: "e-1", payload: { note: "hi" }, attempt: 2 })

            expect(handle).toHaveBeenCalledWith({ eventId: "e-1", event: new PingEvent("e-1", { note: "hi" }), attempt: 2 })
        })

        it("reads the queue payload only when it is an object", async () => {
            const consumer = await registered(() => Promise.resolve())

            expect(consumer.queue.parse({ note: "hi" })).toEqual({ note: "hi" })
            expect(consumer.queue.parse("text")).toBeNull()
        })

        it("refuses a delivery whose envelope is not the event the consumer reads, so it is retried and buried", async () => {
            const handle = jest.fn(() => Promise.resolve())
            const consumer = await registered(handle)

            await expect(
                consumer.handle({ id: "j-1", eventId: "e-1", payload: { note: 7 }, attempt: 1 }),
            ).rejects.toMatchObject({ code: EventBusErrorCode.EnvelopeInvalid })
            expect(handle).not.toHaveBeenCalled()
        })
    })
})

