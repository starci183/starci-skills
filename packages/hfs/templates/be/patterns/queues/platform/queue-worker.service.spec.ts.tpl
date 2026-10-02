import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { QueueHandler } from "./queue.contracts"
import { QUEUE_OPTIONS, QUEUE_TRANSPORT } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import type { QueueTransport } from "./queue-transport.port"
import { QueueWorkerService } from "./queue-worker.service"

const options: QueueOptions = {
    redisHost: "localhost",
    redisPort: 6379,
    prefix: "test",
    relayIntervalMs: 100,
    relayBatch: 2,
    concurrency: 3,
    connections: [],
    schedulers: [{ queue: "sweep", id: "sweep-every-minute", everyMs: 60000 }],
}

const build = async () => {
    const transport = mock<QueueTransport>()
    transport.upsertScheduler.mockResolvedValue(undefined)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            QueueWorkerService,
            { provide: QUEUE_OPTIONS, useValue: options },
            { provide: QUEUE_TRANSPORT, useValue: transport },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { workers: moduleRef.get(QueueWorkerService), transport, logger }
}

describe("QueueWorkerService", () => {
    describe("onApplicationBootstrap", () => {
        it("starts one worker per registered queue with the configured concurrency and registers the schedulers", async () => {
            const { workers, transport } = await build()
            const mailHandler: QueueHandler = () => Promise.resolve()
            const sweepHandler: QueueHandler = () => Promise.resolve()
            workers.add("mail", mailHandler)
            workers.add("sweep", sweepHandler)

            await workers.onApplicationBootstrap()

            expect(transport.work).toHaveBeenCalledWith("mail", mailHandler, 3)
            expect(transport.work).toHaveBeenCalledWith("sweep", sweepHandler, 3)
            expect(transport.upsertScheduler).toHaveBeenCalledWith(options.schedulers[0])
        })

        it("keeps the last handler registered for a queue", async () => {
            const { workers, transport } = await build()
            const first: QueueHandler = () => Promise.resolve()
            const second: QueueHandler = () => Promise.resolve()
            workers.add("mail", first)
            workers.add("mail", second)

            await workers.onApplicationBootstrap()

            expect(transport.work).toHaveBeenCalledTimes(1)
            expect(transport.work).toHaveBeenCalledWith("mail", second, 3)
        })

        it("logs a scheduler that cannot be registered and still starts the app", async () => {
            const { workers, transport, logger } = await build()
            const failure = new Error("redis down")
            transport.upsertScheduler.mockRejectedValue(failure)

            await expect(workers.onApplicationBootstrap()).resolves.toBeUndefined()

            expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.SchedulerFailed, failure, {
                scheduler: "sweep-every-minute",
            })
        })
    })

    describe("onApplicationShutdown", () => {
        it("closes the workers and the queues", async () => {
            const { workers, transport } = await build()

            await workers.onApplicationShutdown()

            expect(transport.close).toHaveBeenCalledTimes(1)
        })
    })
})
