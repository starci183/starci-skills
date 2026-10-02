import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BaseEvent } from "./event-bus.contracts"
import type { ParsedEvent } from "./event-bus.contracts"
import { EVENT_BUS_OPTIONS, EVENT_TRANSPORT } from "./event-bus.decorators"
import { EventBusLogEvent } from "./event-bus.log-events"
import type { EventBusOptions } from "./event-bus.options"
import type { EventConsumer } from "./event-bus.port"
import { EventRunnerService } from "./event-runner.service"
import type { EventSubscription, EventTransport, InboundMessage } from "./event-transport.port"

const AT = "2026-02-03T04:05:06.000Z"
const NOW = new Date(AT).getTime()

const options: EventBusOptions = {
    brokers: ["localhost:9094"],
    groupId: "billing",
    topicPrefix: "run-1.",
    relayIntervalMs: 100,
    relayBatch: 50,
    timeoutMs: 3000,
    connection: Symbol("connection"),
}

class PlacedEvent extends BaseEvent {
    static readonly eventName = "order.placed"
    static readonly version = 1

    readonly eventName = PlacedEvent.eventName

    constructor(
        readonly eventId: string,
        readonly payload: { readonly orderId: string },
    ) {
        super()
    }

    static parse(envelope: unknown): ParsedEvent<PlacedEvent> {
        if (typeof envelope !== "object" || envelope === null) return null
        const { eventId, payload } = envelope as { eventId?: unknown; payload?: { orderId?: unknown } }
        return typeof eventId === "string" && typeof payload?.orderId === "string"
            ? new PlacedEvent(eventId, { orderId: payload.orderId })
            : null
    }
}

const message = (overrides: Partial<InboundMessage> = {}): InboundMessage => ({
    topic: "run-1.events.order",
    partition: 0,
    offset: "4",
    key: "o-1",
    value: JSON.stringify({ eventId: "o-1", eventName: "order.placed", payload: { orderId: "o-1" } }),
    headers: {},
    ...overrides,
})

const build = async () => {
    const transport = mock<EventTransport>()
    const logger = mock<Logger>()
    const handle = jest.fn<Promise<void>, Array<never>>()
    const consumer: EventConsumer<PlacedEvent> = { event: PlacedEvent, handle }
    const moduleRef = await Test.createTestingModule({
        providers: [
            EventRunnerService,
            { provide: EVENT_BUS_OPTIONS, useValue: options },
            { provide: EVENT_TRANSPORT, useValue: transport },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    const runner = moduleRef.get(EventRunnerService)
    runner.add(consumer)
    return { runner, transport, logger, handle }
}

describe("EventRunnerService", () => {
    describe("onApplicationBootstrap", () => {
        it("subscribes to the main and retry topic of every registered event", async () => {
            const { runner, transport } = await build()

            await runner.onApplicationBootstrap()

            const subscription = transport.subscribe.mock.calls[0]?.[0] as EventSubscription
            expect(subscription.topics).toEqual(["run-1.events.order", "run-1.events.order.retry"])
        })

        it("subscribes to nothing when no consumer registered", async () => {
            const { transport } = await build()
            const moduleRef = await Test.createTestingModule({
                providers: [
                    EventRunnerService,
                    { provide: EVENT_BUS_OPTIONS, useValue: options },
                    { provide: EVENT_TRANSPORT, useValue: transport },
                    { provide: CLOCK, useValue: new FakeClock(AT) },
                    { provide: LOGGER, useValue: mock<Logger>() },
                ],
            }).compile()

            await moduleRef.get(EventRunnerService).onApplicationBootstrap()

            expect(transport.subscribe).not.toHaveBeenCalled()
        })

        it("hands what the transport delivers to receive", async () => {
            const { runner, transport, handle } = await build()
            await runner.onApplicationBootstrap()
            const subscription = transport.subscribe.mock.calls[0]?.[0] as EventSubscription

            await subscription.onMessage(message())

            expect(handle).toHaveBeenCalledTimes(1)
        })
    })

    describe("receive", () => {
        it("hands the parsed event to its consumer with the event id and the first attempt", async () => {
            const { runner, handle, transport } = await build()
            handle.mockResolvedValue(undefined)

            await runner.receive(message())

            expect(handle).toHaveBeenCalledWith({
                eventId: "o-1",
                event: new PlacedEvent("o-1", { orderId: "o-1" }),
                attempt: 1,
            })
            expect(transport.send).not.toHaveBeenCalled()
        })

        it("leaves an event nobody here consumes alone", async () => {
            const { runner, handle, transport, logger } = await build()

            await runner.receive(
                message({ value: JSON.stringify({ eventId: "x", eventName: "order.shipped", payload: {} }) }),
            )

            expect(handle).not.toHaveBeenCalled()
            expect(transport.send).not.toHaveBeenCalled()
            expect(logger.warn).not.toHaveBeenCalled()
        })

        it("logs and skips a value that is not an envelope", async () => {
            const { runner, handle, logger } = await build()

            await runner.receive(message({ value: "not json" }))
            await runner.receive(message({ value: JSON.stringify([1]) }))

            expect(handle).not.toHaveBeenCalled()
            expect(logger.warn).toHaveBeenCalledTimes(2)
            expect(logger.warn).toHaveBeenCalledWith(EventBusLogEvent.MessageSkipped, { topic: "run-1.events.order" })
        })

        it("buries an envelope the event class cannot read, without retrying it", async () => {
            const { runner, handle, transport } = await build()
            const value = JSON.stringify({ eventId: "o-2", eventName: "order.placed", payload: {} })

            await runner.receive(message({ key: "o-2", value }))

            expect(handle).not.toHaveBeenCalled()
            expect(transport.send).toHaveBeenCalledWith([
                {
                    topic: "run-1.events.order.dlq",
                    key: "o-2",
                    value,
                    headers: {
                        attempt: "1",
                        reason: "the envelope does not have the shape of the event",
                        "origin-topic": "run-1.events.order",
                    },
                },
            ])
        })

        it("puts a failed delivery on the retry topic with the next attempt and a doubled backoff", async () => {
            const { runner, handle, transport, logger } = await build()
            handle.mockRejectedValue(new Error("order database down"))

            await runner.receive(message({ headers: { attempt: "2" } }))

            expect(transport.send).toHaveBeenCalledWith([
                {
                    topic: "run-1.events.order.retry",
                    key: "o-1",
                    value: message().value,
                    headers: { attempt: "3", "not-before": String(NOW + 1000) },
                },
            ])
            expect(logger.warn).toHaveBeenCalledWith(EventBusLogEvent.DeliveryRetried, {
                event: "order.placed",
                attempt: 2,
                reason: "order database down",
            })
        })

        it("buries the delivery that ran out of attempts, naming the reason and the topic it came from", async () => {
            const { runner, handle, transport, logger } = await build()
            handle.mockRejectedValue("a text, not an error")

            await runner.receive(message({ headers: { attempt: "5" } }))

            expect(transport.send).toHaveBeenCalledWith([
                {
                    topic: "run-1.events.order.dlq",
                    key: "o-1",
                    value: message().value,
                    headers: { attempt: "5", reason: "a text, not an error", "origin-topic": "run-1.events.order" },
                },
            ])
            expect(logger.warn).toHaveBeenCalledWith(EventBusLogEvent.DeliveryBuried, {
                event: "order.placed",
                attempts: 5,
                reason: "a text, not an error",
            })
        })

        it("waits for the backoff of a retry message before handing it over", async () => {
            const { runner, handle, transport } = await build()
            handle.mockResolvedValue(undefined)

            await runner.receive(
                message({
                    topic: "run-1.events.order.retry",
                    headers: { attempt: "2", "not-before": String(NOW + 800) },
                }),
            )

            expect(transport.wait).toHaveBeenCalledWith(800)
            expect(handle).toHaveBeenCalledWith(expect.objectContaining({ attempt: 2 }))
        })

        it("does not wait for a retry message whose backoff has passed", async () => {
            const { runner, handle, transport } = await build()
            handle.mockResolvedValue(undefined)

            await runner.receive(message({ headers: { attempt: "2", "not-before": String(NOW - 5) } }))

            expect(transport.wait).not.toHaveBeenCalled()
            expect(handle).toHaveBeenCalledTimes(1)
        })
    })
})
