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
import { readEnvelope } from "./event-envelope.policy"
import { EventRunnerService } from "./event-runner.service"
import type { EventSubscription, EventTransport, InboundMessage } from "./event-transport.port"

const AT = "2026-02-03T04:05:06.000Z"
const NOW = new Date(AT).getTime()

const options: EventBusOptions = {
    brokers: ["localhost:9094"],
    groupId: "app",
    topicPrefix: "run-1.",
    relayIntervalMs: 100,
    relayBatch: 50,
    timeoutMs: 3000,
    connections: [],
}

interface PingPayload {
    readonly ref: string
}

class PingEvent extends BaseEvent {
    static readonly eventName = "probe.ping"
    static readonly version = 1

    readonly eventName = PingEvent.eventName

    constructor(
        readonly eventId: string,
        readonly payload: PingPayload,
    ) {
        super()
    }

    static parse(envelope: unknown): ParsedEvent<PingEvent> {
        const read = readEnvelope(envelope)
        return read !== null && typeof read.payload.ref === "string"
            ? new PingEvent(read.eventId, { ref: read.payload.ref })
            : null
    }
}

const message = (overrides: Partial<InboundMessage> = {}): InboundMessage => ({
    topic: "run-1.events.probe",
    partition: 0,
    offset: "4",
    key: "o-1",
    value: JSON.stringify({ eventId: "o-1", eventName: "probe.ping", payload: { ref: "o-1" } }),
    headers: {},
    ...overrides,
})

const build = async (register = true) => {
    const transport = mock<EventTransport>()
    const logger = mock<Logger>()
    const handle = jest.fn<Promise<void>, Array<never>>()
    const subscriptions: Array<EventSubscription> = []
    transport.subscribe.mockImplementation((subscription) => {
        subscriptions.push(subscription)
        return Promise.resolve()
    })
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
    if (register) {
        const consumer: EventConsumer<PingEvent> = { event: PingEvent, handle }
        runner.add(consumer)
    }
    return { runner, transport, logger, handle, subscriptions }
}

describe("EventRunnerService", () => {
    describe("onApplicationBootstrap", () => {
        it("subscribes to the main and retry topic of every registered event", async () => {
            const { runner, subscriptions } = await build()

            await runner.onApplicationBootstrap()

            expect(subscriptions.map((subscription) => subscription.topics)).toEqual([
                ["run-1.events.probe", "run-1.events.probe.retry"],
            ])
        })

        it("subscribes to nothing when no consumer registered", async () => {
            const { runner, transport } = await build(false)

            await runner.onApplicationBootstrap()

            expect(transport.subscribe).not.toHaveBeenCalled()
        })

        it("hands what the transport delivers to receive", async () => {
            const { runner, subscriptions, handle } = await build()
            handle.mockResolvedValue(undefined)
            await runner.onApplicationBootstrap()

            await subscriptions[0]?.onMessage(message())

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
                event: new PingEvent("o-1", { ref: "o-1" }),
                attempt: 1,
            })
            expect(transport.send).not.toHaveBeenCalled()
        })

        it("leaves an event nobody here consumes alone", async () => {
            const { runner, handle, transport, logger } = await build()

            await runner.receive(
                message({ value: JSON.stringify({ eventId: "x", eventName: "probe.other", payload: {} }) }),
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
            expect(logger.error).toHaveBeenCalledWith(EventBusLogEvent.MessageSkipped, expect.any(SyntaxError), {
                topic: "run-1.events.probe",
            })
            expect(logger.warn).toHaveBeenCalledTimes(1)
            expect(logger.warn).toHaveBeenCalledWith(EventBusLogEvent.MessageSkipped, { topic: "run-1.events.probe" })
        })

        it("buries an envelope the event class cannot read, without retrying it", async () => {
            const { runner, handle, transport } = await build()
            const value = JSON.stringify({ eventId: "o-2", eventName: "probe.ping", payload: {} })

            await runner.receive(message({ key: "o-2", value }))

            expect(handle).not.toHaveBeenCalled()
            expect(transport.send).toHaveBeenCalledWith([
                {
                    topic: "run-1.events.probe.dlq",
                    key: "o-2",
                    value,
                    headers: {
                        attempt: "1",
                        reason: "the envelope does not have the shape of the event",
                        "origin-topic": "run-1.events.probe",
                    },
                },
            ])
        })

        it("puts a failed delivery on the retry topic with the next attempt and a doubled backoff", async () => {
            const { runner, handle, transport, logger } = await build()
            const failure = new Error("the database is down")
            handle.mockRejectedValue(failure)

            await runner.receive(message({ headers: { attempt: "2" } }))

            expect(transport.send).toHaveBeenCalledWith([
                {
                    topic: "run-1.events.probe.retry",
                    key: "o-1",
                    value: message().value,
                    headers: { attempt: "3", "not-before": String(NOW + 1000) },
                },
            ])
            expect(logger.error).toHaveBeenCalledWith(EventBusLogEvent.DeliveryFailed, failure, {
                event: "probe.ping",
                attempt: 2,
            })
            expect(logger.warn).toHaveBeenCalledWith(EventBusLogEvent.DeliveryRetried, {
                event: "probe.ping",
                attempt: 2,
                reason: "the database is down",
            })
        })

        it("buries the delivery that ran out of attempts, naming the reason and the topic it came from", async () => {
            const { runner, handle, transport, logger } = await build()
            handle.mockRejectedValue("a text, not an error")

            await runner.receive(message({ headers: { attempt: "5" } }))

            expect(transport.send).toHaveBeenCalledWith([
                {
                    topic: "run-1.events.probe.dlq",
                    key: "o-1",
                    value: message().value,
                    headers: { attempt: "5", reason: "a text, not an error", "origin-topic": "run-1.events.probe" },
                },
            ])
            expect(logger.warn).toHaveBeenCalledWith(EventBusLogEvent.DeliveryBuried, {
                event: "probe.ping",
                attempts: 5,
                reason: "a text, not an error",
            })
        })

        it("waits for the backoff of a retry message before handing it over", async () => {
            const { runner, handle, transport } = await build()
            handle.mockResolvedValue(undefined)

            await runner.receive(
                message({
                    topic: "run-1.events.probe.retry",
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
