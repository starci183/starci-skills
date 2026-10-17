import assert from "node:assert/strict"
import { fakeIds } from "@starci/jest-preset"
import type { QueueOptions } from "@modules/platform/queue"
import { useTestWorld, TestWorldError, TestWorldErrorCode, type TestWorld, createQueueProof } from "../../world/kit"

const options: QueueOptions = {
    relayIntervalMs: 1,
    relayBatch: 20,
    concurrency: 1,
    pollIntervalMs: 1,
    visibilityTimeoutMs: 30_000,
    connections: [],
}

interface QueueProof {
    readonly world: TestWorld<ReturnType<typeof createQueueProof>>
    readonly producer: ReturnType<typeof createQueueProof>["producer"]
    readonly nextBooking: () => string
}

const registerAtomicQueueProof = (proof: () => QueueProof) => {
    it("queue/enqueue-atomic-with-transaction: business outbox and pgmq message are invisible before commit and both vanish on rollback", async () => {
        const { world, producer, nextBooking } = proof()
        const kept = nextBooking()
        const lost = nextBooking()
        let inserted: () => void = () => {}
        const ready = new Promise<void>((resolve) => {
            inserted = resolve
        })
        let commit: () => void = () => {}
        const observationComplete = new Promise<void>((resolve) => {
            commit = resolve
        })
        const transaction = world.db.primary.transaction(async (tx) => {
            await producer.enqueueRemindBooking({ bookingId: kept }, tx)
            expect(await world.modules.outboxRows(tx, kept)).toHaveLength(1)
            expect(await world.modules.messages(tx, kept)).toHaveLength(1)
            inserted()
            await observationComplete
        })
        try {
            // Surface a transaction failure instead of waiting forever for its insertion signal.
            await Promise.race([ready, transaction])
            expect(await world.modules.outboxRows(world.db.primary, kept)).toEqual([])
            expect(await world.modules.messages(world.db.primary, kept)).toEqual([])
        } finally {
            commit()
            await transaction
        }
        await expect(
            world.db.primary.transaction(async (tx) => {
                await producer.enqueueRemindBooking({ bookingId: lost }, tx)
                throw new TestWorldError({ code: TestWorldErrorCode.BookingRefused })
            }),
        ).rejects.toThrow(TestWorldErrorCode.BookingRefused)

        expect(await world.modules.outboxRows(world.db.primary, kept)).toHaveLength(1)
        expect(await world.modules.messages(world.db.primary, kept)).toHaveLength(1)
        expect(await world.modules.outboxRows(world.db.primary, lost)).toEqual([])
        expect(await world.modules.messages(world.db.primary, lost)).toEqual([])
    })
}

const registerRelayIdentityProof = (proof: () => QueueProof) => {
    it("queue/relay-job-id-is-outbox-id: the real relay atomically sends a SQL-side row under its outbox identity once", async () => {
        const { world, nextBooking } = proof()
        const bookingId = nextBooking()
        const row = await world.modules.builder.pendingBooking(bookingId)
        expect(row).toBeDefined()
        const relay = world.modules.relay()

        await relay.relay()
        await relay.relay()

        const sent = await world.modules.messages(world.db.primary, bookingId)
        expect(sent).toHaveLength(1)
        expect(sent[0]?.message).toEqual({ jobId: row?.id, payload: { bookingId } })
        expect(await world.modules.outboxRows(world.db.primary, bookingId)).toEqual([
            expect.objectContaining({ id: row?.id, sent_at: expect.any(Date) }),
        ])
    })
}

const registerSchedulerProof = (proof: () => QueueProof) => {
    it("queue/scheduler-fires-once: re-registering the migration's named cron job leaves one scheduler row and one tick sends one message", async () => {
        const { world } = proof()
        const rolledBack = new TestWorldError({ code: TestWorldErrorCode.SchedulerRollback })
        await expect(
            world.db.owner.transaction(async (tx) => {
                const jobs = await world.modules.schedules(tx)
                expect(jobs).toHaveLength(1)
                const [job] = jobs
                assert(job, "Apply the example's public-surface Supabase migration before integration proofs")
                expect(job.schedule).toBe("*/15 * * * *")
                expect(job.command.trim()).toBe(world.modules.tickCommand)
                const first = await world.modules.builder.registerSchedule()
                const second = await world.modules.builder.registerSchedule()
                expect(first).toEqual(second)
                expect(await world.modules.scheduleIds(tx)).toEqual([{ jobid: job.jobid }])
                const count = () => world.modules.countTicks(tx)
                const before = await count()
                await world.modules.builder.tick(tx)
                expect(await count()).toBe(before + 1)
                throw rolledBack
            }),
        ).rejects.toBe(rolledBack)
    })
}

describe("lite queue (local Supabase integration)", () => {
    /** Actual Supabase PostgreSQL transactions and pgmq messages; use a disposable local CLI database. */
    const world = useTestWorld({
        modules: (db) => createQueueProof(db, options),
        cleanup: ({ builder }) => builder.cleanup(bookingIds),
    })

    const bookingIds: Array<string> = []
    const ids = fakeIds("a19")

    const nextBooking = () => {
        const id = `proof-${ids.next()}`
        bookingIds.push(id)
        return id
    }

    const proof = () => ({ world, ...world.modules, nextBooking })
    registerAtomicQueueProof(proof)
    registerRelayIdentityProof(proof)
    registerSchedulerProof(proof)
})
