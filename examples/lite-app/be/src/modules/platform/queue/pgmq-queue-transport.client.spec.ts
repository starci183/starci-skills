import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { QueueDelivery, QueueHandler } from "./queue.contracts"
import { QUEUE_OPTIONS } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import { PgmqQueueTransportClient } from "./pgmq-queue-transport.client"
import { CRON_SCHEDULE, PGMQ_ARCHIVE, PGMQ_READ, PGMQ_SEND, PGMQ_SET_VT } from "./persistence/queue.sql"
import type { PgmqMessageRow } from "./persistence/queue.rows"

const optionsOf = builder<QueueOptions>({
    relayIntervalMs: 100,
    relayBatch: 50,
    concurrency: 4,
    pollIntervalMs: 250,
    visibilityTimeoutMs: 30_000,
    connections: [],
    schedulers: [],
})

const messageOf = builder<PgmqMessageRow>({
    msg_id: "1",
    read_ct: 1,
    message: { jobId: "row-1", payload: { bookingId: "b-1" } },
})

const build = async (manager: MockEntityManager = mockEntityManager()) => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PgmqQueueTransportClient,
            { provide: QUEUE_OPTIONS, useValue: optionsOf() },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { client: moduleRef.get(PgmqQueueTransportClient), manager, logger }
}

/** A handler that fails the deliveries whose job id is listed. */
const handlerOf = (failing: ReadonlyArray<string> = []) => {
    const handler = mock<QueueHandler>({ queue: "booking_confirmation" })
    handler.handle.mockImplementation((delivery: QueueDelivery) =>
        failing.includes(delivery.id) ? Promise.reject(new Error(`job ${delivery.id} failed`)) : Promise.resolve(),
    )
    return handler
}

/** Starts the worker and stops it the first time it pauses; resolves when the worker stopped. */
const runUntilFirstPause = async (client: PgmqQueueTransportClient, handler: QueueHandler) => {
    let stopped: Promise<void> = Promise.resolve()
    let paused: () => void = () => undefined
    const firstPause = new Promise<void>((resolve) => {
        paused = resolve
    })
    const wait = jest.spyOn(client, "wait").mockImplementation(() => {
        stopped = client.close()
        paused()
        return Promise.resolve()
    })
    await client.work(handler, 3)
    await firstPause
    await stopped
    return wait
}

describe("PgmqQueueTransportClient", () => {
    describe("add", () => {
        it("sends the message with the outbox row id on the connection of the caller's transaction", async () => {
            const { client } = await build()
            const tx = fakeTransaction(mockEntityManager({ query: [PGMQ_SEND, [{ msg_id: "9" }]] }))

            await tx.em.transaction((manager) =>
                client.add(manager, "booking_confirmation", "row-1", { bookingId: "b-1" }),
            )

            expect(tx.em.query).toHaveBeenCalledWith(PGMQ_SEND, [
                "booking_confirmation",
                JSON.stringify({ jobId: "row-1", payload: { bookingId: "b-1" } }),
            ])
            expect(tx.commits).toBe(1)
        })
    })

    describe("upsertScheduler", () => {
        it("upserts the pg_cron job of the scheduler with its payload, or an empty one", async () => {
            const { client, manager } = await build(mockEntityManager({ query: [CRON_SCHEDULE, [{ job_id: 1 }]] }))

            await client.upsertScheduler({ queue: "sweep", id: "sweep-often", everyMs: 30_000, payload: { shard: 2 } })
            await client.upsertScheduler({ queue: "sweep", id: "sweep-hourly", everyMs: 3_600_000 })

            expect(manager.query).toHaveBeenNthCalledWith(1, CRON_SCHEDULE, [
                "sweep-often",
                "30 seconds",
                "sweep",
                JSON.stringify({ payload: { shard: 2 } }),
            ])
            expect(manager.query).toHaveBeenNthCalledWith(2, CRON_SCHEDULE, [
                "sweep-hourly",
                "0 */1 * * *",
                "sweep",
                JSON.stringify({ payload: {} }),
            ])
        })
    })

    describe("work", () => {
        it("runs a read batch together, archives completed jobs, retries failed ones with backoff and dead-letters the exhausted", async () => {
            const done = messageOf()
            const retried = messageOf({ msg_id: "2", read_ct: 2, message: { jobId: "row-2", payload: {} } })
            const exhausted = messageOf({ msg_id: "3", read_ct: 5, message: { jobId: "row-3", payload: {} } })
            const { client, manager, logger } = await build(
                mockEntityManager({
                    query: [
                        [PGMQ_READ, [done, retried, exhausted]],
                        [PGMQ_ARCHIVE, [{ archived: true }]],
                        [PGMQ_SET_VT, [{ msg_id: "2" }]],
                        [PGMQ_ARCHIVE, [{ archived: true }]],
                        [PGMQ_READ, []],
                    ],
                }),
            )
            const handler = handlerOf(["row-2", "row-3"])

            const wait = await runUntilFirstPause(client, handler)

            expect(manager.query).toHaveBeenCalledWith(PGMQ_READ, ["booking_confirmation", 30, 3])
            expect(handler.handle).toHaveBeenCalledWith({
                id: "row-1",
                queue: "booking_confirmation",
                payload: { bookingId: "b-1" },
                attempt: 1,
            })
            expect(manager.query).toHaveBeenCalledWith(PGMQ_ARCHIVE, ["booking_confirmation", "1"])
            expect(manager.query).toHaveBeenCalledWith(PGMQ_SET_VT, ["booking_confirmation", "2", 2])
            expect(manager.query).toHaveBeenCalledWith(PGMQ_ARCHIVE, ["booking_confirmation", "3"])
            expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.DeliveryFailed, expect.any(Error), {
                queue: "booking_confirmation",
                messageId: "2",
                attempt: 2,
            })
            expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.DeadLettered, expect.any(Error), {
                queue: "booking_confirmation",
                messageId: "3",
                attempt: 5,
            })
            expect(wait).toHaveBeenCalledWith(250)
        })

        it("logs a read that failed and pauses before reading again", async () => {
            const { client, manager, logger } = await build(mockEntityManager({ query: [PGMQ_READ, []] }))
            const failure = new Error("pgmq unreachable")
            manager.query.mockRejectedValueOnce(failure)

            await runUntilFirstPause(client, handlerOf())

            expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.ReadFailed, failure, {
                queue: "booking_confirmation",
            })
        })

        it("logs a message it could not settle, leaving it to reappear after its visibility timeout", async () => {
            const { client, manager, logger } = await build()
            const failure = new Error("archive refused")
            let reads = 0
            manager.query.mockImplementation((statement: string) => {
                if (statement === PGMQ_ARCHIVE) return Promise.reject(failure)
                reads += 1
                return Promise.resolve(reads === 1 ? [messageOf()] : [])
            })

            await runUntilFirstPause(client, handlerOf())

            expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.SettleFailed, failure, {
                queue: "booking_confirmation",
                messageId: "1",
            })
        })

        it("does not pause after an empty read once it is closing", async () => {
            const { client, manager } = await build(mockEntityManager({ query: [PGMQ_READ, []] }))
            const wait = jest.spyOn(client, "wait")
            let stopped: Promise<void> = Promise.resolve()
            manager.query.mockImplementation(() => {
                stopped = client.close()
                return Promise.resolve([])
            })

            await client.work(handlerOf(), 3)
            await new Promise<void>((resolve) => setImmediate(resolve))
            await stopped

            expect(wait).not.toHaveBeenCalled()
        })
    })

    describe("wait", () => {
        it("waits for the requested delay", async () => {
            jest.useFakeTimers()
            try {
                const { client } = await build()

                const waiting = client.wait(250)
                await jest.advanceTimersByTimeAsync(250)

                await expect(waiting).resolves.toBeUndefined()
            } finally {
                jest.useRealTimers()
            }
        })
    })

    describe("close", () => {
        it("resolves at once when no worker runs", async () => {
            const { client } = await build()

            await expect(client.close()).resolves.toBeUndefined()
        })
    })
})
