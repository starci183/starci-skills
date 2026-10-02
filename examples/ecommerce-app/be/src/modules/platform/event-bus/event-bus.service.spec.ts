import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { CONSUMER_REGISTRY, MESSAGE_PUBLISHER } from "@modules/platform/messaging"
import type { ConsumedMessage, ConsumerRegistry, MessageConsumer, MessagePublisher } from "@modules/platform/messaging"
import type { EventDefinition } from "./event-bus.contracts"
import type { EventConsumer } from "./event-bus.port"
import { EventBusService } from "./event-bus.service"

interface PingPayload {
    readonly note: string
}

const ping: EventDefinition<PingPayload> = {
    name: "probe.ping",
    version: 1,
    attempts: 3,
    backoffMs: 100,
    parse: (value) =>
        typeof value === "object" && value !== null && "note" in value && typeof value.note === "string"
            ? { note: value.note }
            : null,
}

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

describe("EventBusService", () => {
    describe("publish", () => {
        it("publishes the event on the queue named after it, with its event id and payload", async () => {
            const { bus, messages } = await build()

            await bus.publish({ definition: ping, eventId: "e-1", payload: { note: "hi" } }, mockEntityManager())

            expect(messages.publish).toHaveBeenCalledWith({ queue: ping, eventId: "e-1", payload: { note: "hi" } })
        })
    })

    describe("add", () => {
        it("registers the consumer on the queue of its event and hands each message over as a delivery", async () => {
            const { bus, registry } = await build()
            const handle = jest.fn(() => Promise.resolve())
            const consumer: EventConsumer<PingPayload> = { event: ping, handle }

            bus.add(consumer)

            const [registered] = registry.add.mock.calls[0] as [MessageConsumer<PingPayload>]
            expect(registered.queue).toBe(ping)
            const message: ConsumedMessage<PingPayload> = {
                id: "j-1",
                eventId: "e-1",
                payload: { note: "hi" },
                attempt: 2,
            }
            await registered.handle(message)
            expect(handle).toHaveBeenCalledWith({ eventId: "e-1", payload: { note: "hi" }, attempt: 2 })
        })
    })
})
