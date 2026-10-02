import { fakeIds } from "@starci/jest-preset"
import { OrderError, OrderErrorCode } from "@modules/domain/order"
import { readRows } from "../../fixtures/persistence/e2e-verification.rows"
import { ProbeQueue } from "../../fixtures/queues/probe.queue"
import { PROBE_ROWS_OF_NOTE } from "../../fixtures/queues/probe.sql"
import { QUEUE_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { ProbeQueueBehavior } from "../../world/probe-queue.module"
import { useTestWorld } from "../../world/use-test-world"

/** The ids of the rows and keys this spec arranges: deterministic, so a failing run reproduces. */
const ids = fakeIds()

/** How many 250 ms polls a spec watches for something that must NOT happen, or lets time pass. */
const QUIET_POLLS = 6

/** How many polls span three intervals of the probe scheduler (one second each). */
const THREE_INTERVALS_POLLS = 12

/**
 * queue: the real queue capability over the run's Redis and the outbox of the order database. A job is an outbox row written
 * in the transaction of the change and handed to BullMQ only after commit, under the id of its row; a scheduler is upserted by
 * id, so declaring it twice never doubles its ticks. The three scenarios are the proof of the declared `queue` pattern.
 */
describe("queue (integration)", () => {
    const world = useTestWorld({ modules: QUEUE_CAPABILITY_MODULES })

    const producer = (): ProbeQueue => world.resolve(ProbeQueue)
    const behavior = (): ProbeQueueBehavior => world.resolve(ProbeQueueBehavior)
    const polls = (description: string, count: number): Promise<number> => {
        let seen = 0
        return world.waitUntil(
            description,
            () => Promise.resolve((seen += 1)),
            (observed) => observed >= count,
        )
    }

    it("queue/enqueue-atomic-with-transaction: the job commits with the change and is gone with a rollback", async () => {
        const kept = `kept-${ids.next()}`
        const lost = `lost-${ids.next()}`

        await world.db.order.transaction((manager) => producer().enqueueProbe({ note: kept }, manager))
        await expect(
            world.db.order.transaction(async (manager) => {
                await producer().enqueueProbe({ note: lost }, manager)
                throw new OrderError({ code: OrderErrorCode.PlacementFailed })
            }),
        ).rejects.toThrow("ORDER_PLACEMENT_FAILED")

        expect(await readRows(world.db.order, PROBE_ROWS_OF_NOTE, [lost])).toEqual([])
        await world.waitFor("the worker runs the committed job", () =>
            Promise.resolve(behavior().withNote(kept).length > 0 ? true : null),
        )
        await polls("the relay has had several passes", QUIET_POLLS)
        expect(behavior().withNote(lost)).toEqual([])
    })

    it("queue/relay-job-id-is-outbox-id: the BullMQ job id is the outbox row id, and the row is marked sent", async () => {
        const note = `id-${ids.next()}`

        await world.db.order.transaction((manager) => producer().enqueueProbe({ note }, manager))

        const delivery = await world.waitFor("the worker runs the job", () =>
            Promise.resolve(behavior().withNote(note).at(0) ?? null),
        )
        const rows = await world.waitFor("the relay marks the row sent", async () => {
            const found = await readRows(world.db.order, PROBE_ROWS_OF_NOTE, [note])
            return found.length > 0 && found.every((row) => row.sent) ? found : null
        })
        expect(rows).toHaveLength(1)
        expect(delivery.id).toBe(rows[0]?.id)
        expect(behavior().withNote(note)).toHaveLength(1)
    })

    it("queue/scheduler-fires-once: a scheduler declared twice under one id ticks once per interval", async () => {
        const ticks = (): number => behavior().withNote("tick").length
        await world.waitFor("the scheduler ticked", () => Promise.resolve(ticks() >= 1 ? true : null))

        const before = ticks()
        await polls("three intervals passed", THREE_INTERVALS_POLLS)
        const fired = ticks() - before

        expect(fired).toBeGreaterThanOrEqual(2)
        expect(fired).toBeLessThanOrEqual(4)
        const ids = behavior()
            .withNote("tick")
            .map((delivery) => delivery.id)
        expect(new Set(ids).size).toBe(ids.length)
    })
})
