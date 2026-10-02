import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { EventBusErrorCode } from "./errors/event-bus.error"
import { BaseEvent } from "./event-bus.contracts"
import type { ParsedEvent } from "./event-bus.contracts"
import { EVENT_BUS_OPTIONS, EVENT_TRANSPORT } from "./event-bus.decorators"
import type { EventBusOptions } from "./event-bus.options"
import { EventBusService } from "./event-bus.service"
import type { EventTransport, InboundMessage } from "./event-transport.port"
import { INSERT_OUTBOX_ROW } from "./persistence/event-bus.sql"

const AT = "2026-02-03T04:05:06.000Z"

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
    readonly note: string
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

    static parse(): ParsedEvent<PingEvent> {
        return null
    }
}

const DLQ = "run-1.events.probe.dlq"

const envelope = (eventName: string, eventId: string) => JSON.stringify({ eventId, eventName, payload: {} })

const letter = (offset: string, eventName: string, headers: Record<string, string>): InboundMessage => ({
    topic: DLQ,
    partition: 0,
    offset,
    key: `id-${offset}`,
    value: envelope(eventName, `id-${offset}`),
    headers,
})

const build = async () => {
    const transport = mock<EventTransport>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            EventBusService,
            { provide: EVENT_BUS_OPTIONS, useValue: options },
            { provide: EVENT_TRANSPORT, useValue: transport },
            { provide: CLOCK, useValue: new FakeClock(AT) },
        ],
    }).compile()
    return { bus: moduleRef.get(EventBusService), transport }
}

describe("EventBusService", () => {
    describe("publish", () => {
        it("writes the envelope as an outbox row of the caller transaction, keyed by the event id on the topic of the service", async () => {
            const tx = mockEntityManager({ query: [INSERT_OUTBOX_ROW, []] })
            const { bus, transport } = await build()

            await bus.publish(new PingEvent("e-1", { note: "hi" }), tx)

            expect(tx.query).toHaveBeenCalledWith(INSERT_OUTBOX_ROW, [
                "e-1",
                "probe.ping",
                "run-1.events.probe",
                "e-1",
                JSON.stringify({ eventId: "e-1", eventName: "probe.ping", payload: { note: "hi" } }),
                new Date(AT),
            ])
            expect(transport.send).not.toHaveBeenCalled()
        })
    })

    describe("pendingRetries", () => {
        it("is the lag of the retry topic of the event", async () => {
            const { bus, transport } = await build()
            transport.lag.mockResolvedValue(2)

            await expect(bus.pendingRetries(PingEvent)).resolves.toBe(2)

            expect(transport.lag).toHaveBeenCalledWith("run-1.events.probe.retry")
        })
    })

    describe("deadLetters", () => {
        it("lists the buried events of the class, not the other events of the topic, the markers, or the letters a marker closed", async () => {
            const { bus, transport } = await build()
            transport.read.mockResolvedValue([
                letter("0", "probe.ping", { attempt: "5", reason: "refused", "origin-topic": "run-1.events.probe" }),
                letter("1", "probe.other", { attempt: "5", reason: "other", "origin-topic": "run-1.events.probe" }),
                letter("2", "probe.ping", { attempt: "5", reason: "closed", "origin-topic": "run-1.events.probe" }),
                { ...letter("3", "probe.ping", { requeued: `${DLQ}|0|2` }), value: "{}" },
                { ...letter("4", "probe.ping", {}), value: "not json" },
                letter("5", "probe.ping", { "origin-topic": "run-1.events.probe" }),
            ])

            const letters = await bus.deadLetters(PingEvent)

            expect(letters).toEqual([
                { id: `${DLQ}|0|0`, eventName: "probe.ping", eventId: "id-0", reason: "refused", attempts: 5 },
                { id: `${DLQ}|0|5`, eventName: "probe.ping", eventId: "id-5", reason: "", attempts: 0 },
            ])
            expect(transport.read).toHaveBeenCalledWith(DLQ)
        })

        it("treats a value that is a JSON text without an event name as no letter of the class", async () => {
            const { bus, transport } = await build()
            transport.read.mockResolvedValue([{ ...letter("0", "probe.ping", {}), value: "[1]" }])

            await expect(bus.deadLetters(PingEvent)).resolves.toEqual([])
        })
    })

    describe("requeue", () => {
        it("puts the original message back on its main topic and closes the dead letter with a marker", async () => {
            const { bus, transport } = await build()
            const original = letter("7", "probe.ping", { "origin-topic": "run-1.events.probe", reason: "x" })
            transport.read.mockResolvedValue([letter("6", "probe.ping", {}), original])

            await bus.requeue(`${DLQ}|0|7`)

            expect(transport.send).toHaveBeenCalledWith([
                { topic: "run-1.events.probe", key: "id-7", value: original.value, headers: {} },
                { topic: DLQ, key: "id-7", value: "{}", headers: { requeued: `${DLQ}|0|7` } },
            ])
        })

        it("refuses an id the dead-letter topic does not hold", async () => {
            const { bus, transport } = await build()
            transport.read.mockResolvedValue([])

            await expect(bus.requeue(`${DLQ}|0|9`)).rejects.toMatchObject({
                code: EventBusErrorCode.DeadLetterUnknown,
                params: { id: `${DLQ}|0|9` },
            })
            expect(transport.send).not.toHaveBeenCalled()
        })

        it("refuses a letter that does not name the topic it came from", async () => {
            const { bus, transport } = await build()
            transport.read.mockResolvedValue([letter("8", "probe.ping", {})])

            await expect(bus.requeue(`${DLQ}|0|8`)).rejects.toMatchObject({ code: EventBusErrorCode.DeadLetterUnknown })
        })
    })
})
