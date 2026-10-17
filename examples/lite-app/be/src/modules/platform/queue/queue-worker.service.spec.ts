import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { QueueHandler } from "./queue.contracts"
import { QUEUE_OPTIONS, QUEUE_TRANSPORT } from "./queue.decorators"
import type { QueueOptions } from "./queue.options"
import type { QueueTransport } from "./queue-transport.port"
import { QueueWorkerService } from "./queue-worker.service"

const options: QueueOptions = {
    relayIntervalMs: 100,
    relayBatch: 2,
    concurrency: 3,
    pollIntervalMs: 100,
    visibilityTimeoutMs: 30_000,
    connections: [],
}

const handlerOf = (queue: string): QueueHandler => ({ queue, handle: () => Promise.resolve() })

const build = async () => {
    const transport = mock<QueueTransport>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            QueueWorkerService,
            { provide: QUEUE_OPTIONS, useValue: options },
            { provide: QUEUE_TRANSPORT, useValue: transport },
        ],
    }).compile()
    return { workers: moduleRef.get(QueueWorkerService), transport }
}

describe("QueueWorkerService", () => {
    describe("onApplicationBootstrap", () => {
        it("starts one worker per registered queue with the configured concurrency", async () => {
            const { workers, transport } = await build()
            const mailHandler = handlerOf("mail")
            const sweepHandler = handlerOf("sweep")
            workers.add(mailHandler)
            workers.add(sweepHandler)

            await workers.onApplicationBootstrap()

            expect(transport.work).toHaveBeenCalledWith(mailHandler, 3)
            expect(transport.work).toHaveBeenCalledWith(sweepHandler, 3)
        })

        it("keeps the last handler registered for a queue", async () => {
            const { workers, transport } = await build()
            const first = handlerOf("mail")
            const second = handlerOf("mail")
            workers.add(first)
            workers.add(second)

            await workers.onApplicationBootstrap()

            expect(transport.work).toHaveBeenCalledTimes(1)
            expect(transport.work).toHaveBeenCalledWith(second, 3)
        })
    })

    describe("onApplicationShutdown", () => {
        it("stops the workers", async () => {
            const { workers, transport } = await build()

            await workers.onApplicationShutdown()

            expect(transport.close).toHaveBeenCalledTimes(1)
        })

        it("propagates a transport shutdown failure", async () => {
            const { workers, transport } = await build()
            const failure = new Error("delivery could not finish")
            transport.close.mockRejectedValue(failure)

            await expect(workers.onApplicationShutdown()).rejects.toBe(failure)
        })
    })
})
