import { randomUUID } from "node:crypto"
import { CONSUMER_REGISTRY, MESSAGE_PUBLISHER, defineQueue } from "@modules/platform/messaging"
import type { ConsumedMessage, ConsumerRegistry, MessagePublisher } from "@modules/platform/messaging"
import { isRecord } from "@modules/platform/primitives"
import { MESSAGING_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"

interface ProbePayload {
    readonly note: string
}

/** A probe queue of its own per spec, so the specs of one run never read each other's messages: two deliveries, a short backoff. */
const probeQueue = () =>
    defineQueue<ProbePayload>({
        name: `probe.${randomUUID()}`,
        attempts: 2,
        backoffMs: 50,
        parse: (value) => (isRecord(value) && typeof value.note === "string" ? { note: value.note } : null),
    })

/**
 * messaging: the real BullMQ client against the run's own Redis DB, no HTTP door of ours. A message published on a queue
 * reaches the consumer registered for it with its event id, payload and attempt; a delivery that fails is delivered again
 * after the backoff; a message that ran out of attempts waits in the dead letters of its queue with the reason; a payload of
 * the wrong shape is a failed delivery too. A Redis that cannot be reached is the declared messaging-unavailable refusal, and
 * the client publishes again once Redis is back.
 */
describe("messaging: bullmq client (integration)", () => {
    const world = useTestWorld({ modules: MESSAGING_CAPABILITY_MODULES })

    const publisher = (): MessagePublisher => world.resolve<MessagePublisher>(MESSAGE_PUBLISHER)

    /** Registers a consumer and starts its worker the way the app bootstrap does. */
    const consume = (
        queue: ReturnType<typeof probeQueue>,
        handle: (message: ConsumedMessage<ProbePayload>) => Promise<void>,
    ) => {
        world.resolve<ConsumerRegistry>(CONSUMER_REGISTRY).add({ queue, handle })
    }

    it("delivers a published message to its consumer with the event id, the payload and the attempt", async () => {
        const queue = probeQueue()
        const received: Array<ConsumedMessage<ProbePayload>> = []
        consume(queue, (message) => {
            received.push(message)
            return Promise.resolve()
        })

        await publisher().publish({ queue, eventId: "e-1", payload: { note: "hello" } })

        await world.waitFor("the consumer receives the message", () =>
            Promise.resolve(received.length > 0 ? true : null),
        )
        expect(received).toEqual([expect.objectContaining({ eventId: "e-1", payload: { note: "hello" }, attempt: 1 })])
    })

    it("delivers a failed message again after the backoff, then keeps it in the dead letters with the reason", async () => {
        const queue = probeQueue()
        const attempts: Array<number> = []
        consume(queue, (message) => {
            attempts.push(message.attempt)
            return Promise.reject(new Error("handler refused"))
        })

        await publisher().publish({ queue, eventId: "e-2", payload: { note: "doomed" } })

        const dead = await world.waitFor("the message is in the dead letters", async () => {
            const letters = await publisher().deadLetters(queue)
            return letters.length > 0 ? letters : null
        })
        expect(attempts).toEqual([1, 2])
        expect(dead).toEqual([expect.objectContaining({ eventId: "e-2", reason: "handler refused", attempts: 2 })])
    })

    it("an unreachable Redis is the declared messaging-unavailable refusal, and the client publishes again once Redis is back", async () => {
        const queue = probeQueue()

        await world.infra.redis.during(async () => {
            await expect(
                publisher().publish({ queue, eventId: "e-3", payload: { note: "lost" } }),
            ).rejects.toMatchObject({
                code: "MESSAGING_UNAVAILABLE",
            })
        })

        // The client reconnects on its own; the first command after the outage may still meet the dropped connection.
        await world.waitFor("the queue accepts messages again", () =>
            publisher()
                .publish({ queue, eventId: "e-4", payload: { note: "back" } })
                .then(
                    () => true,
                    () => null,
                ),
        )
    })
})
