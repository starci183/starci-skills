import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_OPTIONS, QUEUE_RELAY_MANAGERS, QUEUE_TRANSPORT } from "./queue.decorators"
import { OutboxLogEvent } from "@modules/platform/outbox"
import type { QueueOptions } from "./queue.options"
import { QueueRelayService } from "./queue-relay.service"
import type { QueueTransport } from "./queue-transport.port"
import { MARK_ROWS_SENT, SELECT_WAITING_ROWS } from "./persistence/queue.sql"

const AT = "2026-02-03T04:05:06.000Z"

const options: QueueOptions = {
    redisHost: "localhost",
    redisPort: 6379,
    prefix: "test",
    relayIntervalMs: 100,
    relayBatch: 2,
    concurrency: 1,
    connections: [],
    schedulers: [],
}

const row = (id: string) => ({ id, queue: "mail", payload: { id: `m-${id}` } })

const build = async (manager: MockEntityManager) => {
    const transport = mock<QueueTransport>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            QueueRelayService,
            { provide: QUEUE_OPTIONS, useValue: options },
            { provide: QUEUE_RELAY_MANAGERS, useValue: [manager] },
            { provide: QUEUE_TRANSPORT, useValue: transport },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { relay: moduleRef.get(QueueRelayService), transport, logger }
}

describe("QueueRelayService", () => {
    describe("relay", () => {
        it("adds the waiting rows to BullMQ with the row id as the job id and marks them sent in the same transaction", async () => {
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
            expect(transport.add).toHaveBeenNthCalledWith(1, "mail", "1", { id: "m-1" })
            expect(transport.add).toHaveBeenNthCalledWith(2, "mail", "2", { id: "m-2" })
            expect(tx.em.query).toHaveBeenNthCalledWith(2, MARK_ROWS_SENT, [["1", "2"], new Date(AT)])
            expect(tx.commits).toBe(1)
        })

        it("adds nothing and marks nothing when no row waits", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [SELECT_WAITING_ROWS, []] }))
            const { relay, transport } = await build(tx.em)

            await expect(relay.relay()).resolves.toBe(0)

            expect(transport.add).not.toHaveBeenCalled()
            expect(tx.em.query).toHaveBeenCalledTimes(1)
        })

        it("leaves the rows unmarked when BullMQ refuses, so the next pass adds them again", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [SELECT_WAITING_ROWS, [row("1")]] }))
            const { relay, transport } = await build(tx.em)
            const failure = new Error("redis down")
            transport.add.mockRejectedValue(failure)

            await expect(relay.relay()).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
            expect(tx.em.query).toHaveBeenCalledTimes(1)
        })
    })

    describe("the loop", () => {
        it("passes again at once after a pass that added rows, pauses on an empty outbox, logs a failed pass and stops on shutdown", async () => {
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

            expect(transport.add).toHaveBeenCalledTimes(1)
            expect(transport.wait).toHaveBeenCalledWith(100)
            expect(logger.error).toHaveBeenCalledWith(OutboxLogEvent.RelayFailed, failure, { outbox: "queue" })
        })
    })
})
