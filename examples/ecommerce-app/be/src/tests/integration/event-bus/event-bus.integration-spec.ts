import { randomUUID } from "node:crypto"
import { EVENT_BUS } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { OrderError, OrderErrorCode } from "@modules/domain/order"
import { ProbePingEvent } from "../../fixtures/events/probe-ping.event"
import { readRows } from "../../fixtures/persistence/e2e-verification.rows"
import { DUPLICATE_OUTBOX_ROW, OUTBOX_OF_EVENT } from "../../fixtures/persistence/e2e-verification.sql"
import { EVENT_BUS_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { ProbeBehavior } from "../../world/probe-consumer.module"
import { useTestWorld } from "../../world/use-test-world"

/** How many 250 ms polls a spec watches for something that must NOT happen (the relay passes every 100 ms, so each poll spans two). */
const QUIET_POLLS = 8

/**
 * event-bus: the real bus over the run's Kafka and the order database, no HTTP door of ours. The outbox row is written in the
 * transaction of the change and leaves only once that transaction commits; a failing consumer is retried with a backoff and then
 * buried in the dead letters, from where an operator puts it back; a delivery that arrives twice changes nothing twice because
 * the consumer claims the event id in the inbox. The four scenarios are the proof of the declared `event-bus` pattern.
 */
describe("event bus (integration)", () => {
    const world = useTestWorld({ modules: EVENT_BUS_CAPABILITY_MODULES })

    const bus = (): EventBus => world.resolve<EventBus>(EVENT_BUS)
    const eventId = (): string => `probe-${randomUUID()}`

    it("event-bus/atomic-with-transaction: the outbox row commits with the change and is gone with a rollback", async () => {
        const kept = eventId()
        const lost = eventId()

        await world.db.order.transaction((manager) =>
            bus().publish(ProbePingEvent.create(kept, { note: "kept" }), manager),
        )
        await expect(
            world.db.order.transaction(async (manager) => {
                await bus().publish(ProbePingEvent.create(lost, { note: "lost" }), manager)
                throw new OrderError({ code: OrderErrorCode.PlacementFailed })
            }),
        ).rejects.toThrow("ORDER_PLACEMENT_FAILED")

        expect(await readRows(world.db.order, OUTBOX_OF_EVENT, [kept])).toEqual([
            expect.objectContaining({ event_name: "probe.ping" }),
        ])
        expect(await readRows(world.db.order, OUTBOX_OF_EVENT, [lost])).toEqual([])
        const sent = await world.waitFor("the relay marks the committed row sent", async () => {
            const rows = await readRows(world.db.order, OUTBOX_OF_EVENT, [kept])
            return rows.every((row) => row.sent) ? rows : null
        })
        expect(sent).toHaveLength(1)
    })

    it("event-bus/relay-only-after-commit: nothing reaches the consumer while the transaction is open, everything once it commits", async () => {
        const behavior = world.resolve(ProbeBehavior)
        const id = eventId()
        let commit: () => void = () => undefined
        const gate = new Promise<void>((resolve) => {
            commit = resolve
        })
        let polls = 0

        const transaction = world.db.order.transaction(async (manager) => {
            await bus().publish(ProbePingEvent.create(id, { note: "late" }), manager)
            await world.waitUntil(
                "the relay has had many passes while the transaction stays open",
                () => {
                    polls += 1
                    return Promise.resolve(polls)
                },
                (observed) => observed >= QUIET_POLLS,
            )
            expect(behavior.effects).not.toContain("late")
            await gate
        })
        await world.waitUntil(
            "the publisher is waiting for its commit",
            () => Promise.resolve(polls),
            (observed) => observed >= QUIET_POLLS,
        )
        commit()
        await transaction

        await world.waitFor("the consumer receives the committed event", () =>
            Promise.resolve(behavior.effects.includes("late") ? true : null),
        )
    })

    it("event-bus/redelivery-then-dead-letter: a failing consumer is retried, then buried, and an operator requeue delivers it", async () => {
        const behavior = world.resolve(ProbeBehavior)
        behavior.failing = true
        behavior.attempts.length = 0
        const id = eventId()

        await world.db.order.transaction((manager) =>
            bus().publish(ProbePingEvent.create(id, { note: "doomed" }), manager),
        )

        const letters = await world.waitFor("the event is in the dead letters", async () => {
            const found = (await bus().deadLetters(ProbePingEvent)).filter((letter) => letter.eventId === id)
            return found.length > 0 ? found : null
        })
        expect(behavior.attempts).toEqual([1, 2, 3, 4, 5])
        expect(letters).toEqual([
            expect.objectContaining({
                eventName: "probe.ping",
                eventId: id,
                reason: "ORDER_PLACEMENT_FAILED",
                attempts: 5,
            }),
        ])

        behavior.failing = false
        behavior.attempts.length = 0
        await bus().requeue(letters[0]?.id ?? "")

        await world.waitFor("the requeued event is delivered once more", () =>
            Promise.resolve(behavior.effects.includes("doomed") ? true : null),
        )
        expect(behavior.attempts).toEqual([1])
        expect((await bus().deadLetters(ProbePingEvent)).filter((letter) => letter.eventId === id)).toEqual([])
    })

    it("event-bus/duplicate-delivery-is-a-noop: an event sent twice runs its effect once", async () => {
        const behavior = world.resolve(ProbeBehavior)
        behavior.attempts.length = 0
        const id = eventId()
        await world.db.order.transaction((manager) =>
            bus().publish(ProbePingEvent.create(id, { note: "twice" }), manager),
        )
        await world.db.order.query(DUPLICATE_OUTBOX_ROW, [id])

        await world.waitFor("the consumer saw the event twice", () =>
            Promise.resolve(behavior.attempts.length >= 2 ? true : null),
        )

        expect(behavior.effects.filter((note) => note === "twice")).toHaveLength(1)
    })
})
