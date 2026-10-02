import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { EVENT_BUS_OPTIONS, EVENT_RELAY_MANAGERS, EVENT_TRANSPORT } from "./event-bus.decorators"
import { EventBusLogEvent } from "./event-bus.log-events"
import type { EventBusOptions } from "./event-bus.options"
import { EventRelayService } from "./event-relay.service"
import type { EventTransport } from "./event-transport.port"
import { MARK_ROWS_SENT, SELECT_WAITING_ROWS } from "./persistence/event-bus.sql"

const AT = "2026-02-03T04:05:06.000Z"

const options: EventBusOptions = {
    brokers: ["localhost:9094"],
    groupId: "app",
    topicPrefix: "",
    relayIntervalMs: 100,
    relayBatch: 2,
    timeoutMs: 3000,
    connections: [],
}

const row = (id: string) => ({
    id,
    topic: "events.probe",
    message_key: `o-${id}`,
    envelope: { eventId: `o-${id}`, eventName: "probe.ping", payload: {} },
})

const build = async (manager: MockEntityManager) => {
    const transport = mock<EventTransport>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            EventRelayService,
            { provide: EVENT_BUS_OPTIONS, useValue: options },
            { provide: EVENT_RELAY_MANAGERS, useValue: [manager] },
            { provide: EVENT_TRANSPORT, useValue: transport },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { relay: moduleRef.get(EventRelayService), transport, logger }
}

describe("EventRelayService", () => {
    describe("relay", () => {
        it("sends the waiting rows in order and marks them sent in the same transaction", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [SELECT_WAITING_ROWS, [row("1"), row("2")]],
                        [MARK_ROWS_SENT, []],
                    ],
                }),
            )
            const { relay, transport } = await build(tx.em)

            await expect(relay.relay()).resolves.toBe(2)

            expect(tx.em.query).toHaveBeenNthCalledWith(1, SELECT_WAITING_ROWS, [2])
            expect(transport.send).toHaveBeenCalledWith([
                { topic: "events.probe", key: "o-1", value: JSON.stringify(row("1").envelope), headers: {} },
                { topic: "events.probe", key: "o-2", value: JSON.stringify(row("2").envelope), headers: {} },
            ])
            expect(tx.em.query).toHaveBeenNthCalledWith(2, MARK_ROWS_SENT, [["1", "2"], new Date(AT)])
            expect(tx.commits).toBe(1)
        })

        it("sends nothing and marks nothing when no row waits", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [SELECT_WAITING_ROWS, []] }))
            const { relay, transport } = await build(tx.em)

            await expect(relay.relay()).resolves.toBe(0)

            expect(transport.send).not.toHaveBeenCalled()
            expect(tx.em.query).toHaveBeenCalledTimes(1)
        })

        it("leaves the rows unmarked when the broker refuses, so the next pass sends them again", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [SELECT_WAITING_ROWS, [row("1")]] }))
            const { relay, transport } = await build(tx.em)
            const failure = new Error("broker down")
            transport.send.mockRejectedValue(failure)

            await expect(relay.relay()).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
            expect(tx.em.query).toHaveBeenCalledTimes(1)
        })
    })

    describe("the loop", () => {
        it("passes again at once after a pass that sent rows, pauses on an empty outbox, logs a failed pass and stops on shutdown", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [SELECT_WAITING_ROWS, [row("1")]],
                        [MARK_ROWS_SENT, []],
                        [SELECT_WAITING_ROWS, []],
                    ],
                }),
            )
            const { relay, transport, logger } = await build(tx.em)
            const failure = new Error("outbox unreadable")
            let waits = 0
            let shutdown: Promise<void> = Promise.resolve()
            let reachedSecondWait: () => void = () => undefined
            const secondWait = new Promise<void>((resolve) => {
                reachedSecondWait = resolve
            })
            transport.wait.mockImplementation(() => {
                waits += 1
                if (waits === 1) tx.em.query.mockRejectedValueOnce(failure)
                else {
                    shutdown = relay.onApplicationShutdown()
                    reachedSecondWait()
                }
                return Promise.resolve()
            })

            relay.onApplicationBootstrap()
            await secondWait
            await shutdown

            expect(transport.send).toHaveBeenCalledTimes(1)
            expect(transport.wait).toHaveBeenCalledWith(100)
            expect(logger.error).toHaveBeenCalledWith(EventBusLogEvent.RelayFailed, failure)
        })
    })
})
