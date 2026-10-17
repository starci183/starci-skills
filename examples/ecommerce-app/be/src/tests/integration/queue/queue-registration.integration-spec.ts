import type { QueueOutbox } from "@modules/platform/queue"
import { QueueModule } from "@modules/platform/queue"
import { QUEUE_OUTBOX_CAPABILITY_MODULES, QUEUE_REGISTRATION_TOKENS } from "../../world/test-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"

describe("queue registration (integration)", () => {
    const world = useTestWorld({ modules: QUEUE_OUTBOX_CAPABILITY_MODULES })
    describe("register", () => {
        it("provides the outbox writer to a one-off app without delivery lifecycle providers", () => {
            expect(world.resolve<QueueOutbox>(QUEUE_REGISTRATION_TOKENS.outbox)).toBe(
                world.resolve(QUEUE_REGISTRATION_TOKENS.writer),
            )
            for (const provider of [
                QUEUE_REGISTRATION_TOKENS.relay,
                QUEUE_REGISTRATION_TOKENS.worker,
                QUEUE_REGISTRATION_TOKENS.factory,
                QUEUE_REGISTRATION_TOKENS.transport,
                QUEUE_REGISTRATION_TOKENS.workerRegistry,
            ]) {
                expect(() => world.resolve<unknown>(provider)).toThrow()
            }
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

            expect(registration.providers).toEqual(
                expect.arrayContaining([QUEUE_REGISTRATION_TOKENS.relay, QUEUE_REGISTRATION_TOKENS.worker]),
            )
            expect(registration.exports).toContain(QUEUE_REGISTRATION_TOKENS.workerRegistry)
            expect(registration.exports).toContain(QUEUE_REGISTRATION_TOKENS.transport)
        })
    })
})
