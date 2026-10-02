import { randomUUID } from "node:crypto"
import { OrderError, OrderErrorCode } from "@modules/domain/order"
import { QUEUE_TRANSPORT } from "@modules/platform/queue"
import type { QueueSchedulerDefinition } from "@modules/platform/queue"
import { readRows } from "../../fixtures/persistence/e2e-verification.rows"
import { ProbeQueue } from "../../fixtures/queues/probe.queue"
import { PROBE_ROWS_OF_NOTE } from "../../fixtures/queues/probe.sql"
import { QUEUE_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { ProbeQueueBehavior } from "../../world/probe-queue.module"
import { useTestWorld } from "../../world/use-test-world"

/** How many 250 ms polls a spec watches for something that must NOT happen. */
const QUIET_POLLS = 6

/**
 * queue: the real queue capability over the run's Redis and the outbox of the order database. A job is an outbox row written
 * in the transaction of the change and handed to BullMQ only after commit, under the id of its row; a scheduler is upserted by
 * id, so registering it again never doubles its ticks. The three scenarios are the proof of the declared `queue` pattern.
 */
describe("queue (integration)", () => {
    const world = useTestWorld({ modules: QUEUE_CAPABILITY_MODULES })

    const producer = (): ProbeQueue => world.resolve(ProbeQueue)
    const behavior = (): ProbeQueueBehavior => world.resolve(ProbeQueueBehavior)
    const noteOf = (delivery: { payload: object }): unknown => (delivery.payload as { note?: unknown }).note

    it("queue/enqueue-atomic-with-transaction: the job commits with the change and is gone with a rollback", async () => {
        const kept = `kept-${randomUUID()}`
        const lost = `lost-${randomUUID()}`

        await world.db.order.transaction((manager) => producer().enqueueProbe({ note: kept }, manager))
        await expect(
            world.db.order.transaction(async (manager) => {
                await producer().enqueueProbe({ note: lost }, manager)
                throw new OrderError({ code: OrderErrorCode.PlacementFailed })
            }),
        ).rejects.toThrow("ORDER_PLACEMENT_FAILED")

        expect(await readRows(world.db.order, PROBE_ROWS_OF_NOTE, [lost])).toEqual([])
        await world.waitFor("the worker runs the committed job", () =>
            Promise.resolve(behavior().deliveries.some((delivery) => noteOf(delivery) === kept) ? true : null),
        )
        await world.waitUntil(
            "the relay has had several passes",
            () => Promise.resolve(QUIET_POLLS),
            (observed) => observed >= QUIET_POLLS,
        )
        expect(behavior().deliveries.some((delivery) => noteOf(delivery) === lost)).toBe(false)
    })

    it("queue/relay-job-id-is-outbox-id: the BullMQ job id is the outbox row id, and the row is marked sent", async () => {
        const note = `id-${randomUUID()}`

        await world.db.order.transaction((manager) => producer().enqueueProbe({ note }, manager))

        const delivery = await world.waitFor("the worker runs the job", () =>
            Promise.resolve(behavior().deliveries.find((candidate) => noteOf(candidate) === note) ?? null),
        )
        const rows = await world.waitFor("the relay marks the row sent", async () => {
            const found = await readRows(world.db.order, PROBE_ROWS_OF_NOTE, [note])
            return found.length > 0 && found.every((row) => row.sent) ? found : null
        })
        expect(rows).toHaveLength(1)
        expect(delivery.id).toBe(rows[0]?.id)
        expect(behavior().deliveries.filter((candidate) => noteOf(candidate) === note)).toHaveLength(1)
    })

    it("queue/scheduler-fires-once: a scheduler ticks once per interval, and registering it again does not double the ticks", async () => {
        const ticks = (): number => behavior().deliveries.filter((delivery) => noteOf(delivery) === "tick").length
        await world.waitFor("the scheduler ticked", () => Promise.resolve(ticks() >= 1 ? true : null))
        const again: QueueSchedulerDefinition = {
            queue: "probe",
            id: "probe-tick",
            everyMs: 1000,
            payload: { note: "tick" },
        }
        await world
            .resolve<{ upsertScheduler(scheduler: QueueSchedulerDefinition): Promise<void> }>(QUEUE_TRANSPORT)
            .upsertScheduler(again)

        const before = ticks()
        const startedAt = Date.now()
        await world.waitFor("three intervals passed", () =>
            Promise.resolve(Date.now() - startedAt >= 3000 ? true : null),
        )
        const fired = ticks() - before

        expect(fired).toBeGreaterThanOrEqual(2)
        expect(fired).toBeLessThanOrEqual(4)
        const ids = behavior()
            .deliveries.filter((delivery) => noteOf(delivery) === "tick")
            .map((delivery) => delivery.id)
        expect(new Set(ids).size).toBe(ids.length)
    })
})
