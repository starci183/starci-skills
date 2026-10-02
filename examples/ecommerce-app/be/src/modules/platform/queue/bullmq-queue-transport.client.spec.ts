import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BullmqQueueTransportClient } from "./bullmq-queue-transport.client"
import type { QueueHandler } from "./queue.contracts"
import { QUEUE_FACTORY, QUEUE_OPTIONS } from "./queue.decorators"
import type { QueueOptions } from "./queue.options"
import { ATTEMPTS, BACKOFF_MS, KEEP_COMPLETED_SECONDS } from "./queue.policy"
import type { BullmqJob, BullmqQueue, BullmqWorker, QueueFactory } from "./queue-transport.port"

const options: QueueOptions = {
    redisHost: "redis.test",
    redisPort: 6380,
    prefix: "spec.",
    relayIntervalMs: 100,
    relayBatch: 50,
    concurrency: 4,
    connections: [],
    schedulers: [],
}

const build = async () => {
    const queue = mock<BullmqQueue>()
    const worker = mock<BullmqWorker>()
    const factory = mock<QueueFactory>()
    factory.queue.mockReturnValue(queue)
    factory.worker.mockReturnValue(worker)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BullmqQueueTransportClient,
            { provide: QUEUE_OPTIONS, useValue: options },
            { provide: QUEUE_FACTORY, useValue: factory },
        ],
    }).compile()
    return { client: moduleRef.get(BullmqQueueTransportClient), queue, worker, factory }
}

describe("BullmqQueueTransportClient", () => {
    it("adds idempotent jobs with the queue retry and retention policy", async () => {
        const { client, queue, factory } = await build()
        const payload = { orderId: "order-1" }

        await client.add("orders", "outbox-1", payload)
        await client.add("orders", "outbox-2", payload)

        expect(factory.queue).toHaveBeenCalledTimes(1)
        expect(factory.queue).toHaveBeenCalledWith("orders", {
            prefix: "spec.",
            connection: { host: "redis.test", port: 6380, maxRetriesPerRequest: null },
        })
        expect(queue.add).toHaveBeenNthCalledWith(1, "orders", payload, {
            jobId: "outbox-1",
            attempts: ATTEMPTS,
            backoff: { type: "exponential", delay: BACKOFF_MS },
            removeOnComplete: { age: KEEP_COMPLETED_SECONDS },
        })
    })

    it("upserts schedulers with their payload or an empty payload", async () => {
        const { client, queue } = await build()

        await client.upsertScheduler({ queue: "billing", id: "settlement", everyMs: 60_000, payload: { shard: 2 } })
        await client.upsertScheduler({ queue: "billing", id: "cleanup", everyMs: 120_000 })

        expect(queue.upsertJobScheduler).toHaveBeenNthCalledWith(
            1,
            "settlement",
            { every: 60_000 },
            { name: "billing", data: { shard: 2 }, opts: { attempts: ATTEMPTS } },
        )
        expect(queue.upsertJobScheduler).toHaveBeenNthCalledWith(
            2,
            "cleanup",
            { every: 120_000 },
            { name: "billing", data: {}, opts: { attempts: ATTEMPTS } },
        )
    })

    it("starts a worker that translates BullMQ jobs into queue deliveries", async () => {
        const { client, factory } = await build()
        const handler = mock<QueueHandler>({ queue: "orders" })
        handler.handle.mockResolvedValue(undefined)

        await client.work(handler, 3)

        expect(factory.worker).toHaveBeenCalledWith("orders", expect.any(Function), {
            prefix: "spec.",
            connection: { host: "redis.test", port: 6380, maxRetriesPerRequest: null },
            concurrency: 3,
        })
        const processor = factory.worker.mock.calls[0]?.[1]
        await processor?.(mock<BullmqJob>({ id: "job-1", data: { orderId: "order-1" }, attemptsMade: 2 }))
        await processor?.(mock<BullmqJob>({ id: undefined, data: { orderId: "order-2" }, attemptsMade: 0 }))

        expect(handler.handle).toHaveBeenNthCalledWith(1, {
            id: "job-1",
            queue: "orders",
            payload: { orderId: "order-1" },
            attempt: 3,
        })
        expect(handler.handle).toHaveBeenNthCalledWith(2, {
            id: "",
            queue: "orders",
            payload: { orderId: "order-2" },
            attempt: 1,
        })
    })

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

    it("closes workers before queues", async () => {
        const { client, queue, worker } = await build()
        const handler = mock<QueueHandler>({ queue: "orders" })
        let finishWorkerClose: (() => void) | undefined
        worker.close.mockReturnValue(
            new Promise((resolve) => {
                finishWorkerClose = resolve
            }),
        )
        await client.add("orders", "outbox-1", {})
        await client.work(handler, 3)

        const closing = client.close()

        expect(worker.close).toHaveBeenCalledWith(true)
        expect(queue.close).not.toHaveBeenCalled()
        finishWorkerClose?.()
        await closing
        expect(queue.close).toHaveBeenCalledTimes(1)
    })
})
