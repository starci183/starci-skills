import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { QueueOutbox } from "./queue.port"
import { QueueModule } from "./queue.module"
import { QueueOutboxService } from "./queue-outbox.service"
import { QueueRelayService } from "./queue-relay.service"
import { QueueWorkerService } from "./queue-worker.service"
import { QUEUE_FACTORY, QUEUE_OUTBOX, QUEUE_TRANSPORT, QUEUE_WORKER_REGISTRY } from "./queue.decorators"

describe("QueueModule", () => {
    describe("register", () => {
        it("provides the outbox writer to a one-off app without delivery lifecycle providers", async () => {
            const outbox = mock<QueueOutbox>()
            const moduleRef = await Test.createTestingModule({ imports: [QueueModule.register({ outboxOnly: true })] })
                .overrideProvider(QueueOutboxService)
                .useValue(outbox)
                .compile()

            expect(moduleRef.get<QueueOutbox>(QUEUE_OUTBOX)).toBe(outbox)
            for (const provider of [QueueRelayService, QueueWorkerService, QUEUE_FACTORY, QUEUE_TRANSPORT, QUEUE_WORKER_REGISTRY]) {
                expect(() => moduleRef.get(provider)).toThrow()
            }
            await moduleRef.close()
        })

        it("keeps the relay and worker registrations in the normal runtime capability", () => {
            const registration = QueueModule.register({
                redisHost: "redis",
                redisPort: 6379,
                redisDb: 0,
                prefix: "queue",
                relayIntervalMs: 200,
                relayBatch: 50,
                concurrency: 5,
                connections: [],
                schedulers: [],
            })

            expect(registration.providers).toEqual(expect.arrayContaining([QueueRelayService, QueueWorkerService]))
            expect(registration.exports).toContain(QUEUE_WORKER_REGISTRY)
            expect(registration.exports).toContain(QUEUE_TRANSPORT)
        })
    })
})
