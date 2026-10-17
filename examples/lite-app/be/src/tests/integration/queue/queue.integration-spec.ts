import assert from "node:assert/strict"
import type { EntityManager } from "typeorm"
import { FakeClock, fakeIds, mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { BookingReminderQueue, BOOKING_REMINDER_QUEUE } from "@modules/queues/booking-reminder"
import { PgmqQueueTransportClient } from "@modules/platform/queue/pgmq-queue-transport.client"
import { QueueOutboxService } from "@modules/platform/queue/queue-outbox.service"
import { QueueRelayService } from "@modules/platform/queue/queue-relay.service"
import type { QueueOptions } from "@modules/platform/queue/queue.options"
import { createQueueDatabaseWorld } from "../../world/queue.database.builder"

const options: QueueOptions = {
    relayIntervalMs: 1,
    relayBatch: 20,
    concurrency: 1,
    pollIntervalMs: 1,
    visibilityTimeoutMs: 30_000,
    connections: [],
}

const outboxRows = (manager: EntityManager, bookingId: string) =>
    manager.query("SELECT id, payload, sent_at FROM public.queue WHERE queue = $1 AND payload->>'bookingId' = $2", [
        BOOKING_REMINDER_QUEUE,
        bookingId,
    ])

const messages = (manager: EntityManager, bookingId: string) =>
    manager.query("SELECT msg_id, message FROM pgmq.q_booking_reminder WHERE message->'payload'->>'bookingId' = $1", [
        bookingId,
    ])

interface QueueProof {
    readonly world: ReturnType<typeof createQueueDatabaseWorld>
    readonly transport: PgmqQueueTransportClient
    readonly producer: BookingReminderQueue
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
        const transaction = world.manager.transaction(async (tx) => {
            await producer.enqueueRemindBooking({ bookingId: kept }, tx)
            expect(await outboxRows(tx, kept)).toHaveLength(1)
            expect(await messages(tx, kept)).toHaveLength(1)
            inserted()
            await observationComplete
        })
        try {
            // Surface a transaction failure instead of waiting forever for its insertion signal.
            await Promise.race([ready, transaction])
            expect(await outboxRows(world.manager, kept)).toEqual([])
            expect(await messages(world.manager, kept)).toEqual([])
        } finally {
            commit()
            await transaction
        }
        await expect(
            world.manager.transaction(async (tx) => {
                await producer.enqueueRemindBooking({ bookingId: lost }, tx)
                throw new Error("booking refused")
            }),
        ).rejects.toThrow("booking refused")

        expect(await outboxRows(world.manager, kept)).toHaveLength(1)
        expect(await messages(world.manager, kept)).toHaveLength(1)
        expect(await outboxRows(world.manager, lost)).toEqual([])
        expect(await messages(world.manager, lost)).toEqual([])
    })
}

const registerRelayIdentityProof = (proof: () => QueueProof) => {
    it("queue/relay-job-id-is-outbox-id: the real relay atomically sends a SQL-side row under its outbox identity once", async () => {
        const { world, transport, nextBooking } = proof()
        const bookingId = nextBooking()
        const [row] = await world.manager.query<Array<{ id: string }>>(
            "INSERT INTO public.queue (queue, payload, created_at) VALUES ($1, $2::jsonb, now()) RETURNING id",
            [BOOKING_REMINDER_QUEUE, JSON.stringify({ bookingId })],
        )
        expect(row).toBeDefined()
        const relay = new QueueRelayService(options, [world.manager], transport, new FakeClock(), mock<Logger>())

        await relay.relay()
        await relay.relay()

        const sent = await messages(world.manager, bookingId)
        expect(sent).toHaveLength(1)
        expect(sent[0]?.message).toEqual({ jobId: row?.id, payload: { bookingId } })
        expect(await outboxRows(world.manager, bookingId)).toEqual([
            expect.objectContaining({ id: row?.id, sent_at: expect.any(Date) }),
        ])
    })
}

const registerSchedulerProof = (proof: () => QueueProof) => {
    it("queue/scheduler-fires-once: re-registering the migration's named cron job leaves one scheduler row and one tick sends one message", async () => {
        const { world } = proof()
        const rolledBack = new Error("restore the scheduler and tick after proof")
        await expect(
            world.manager.transaction(async (tx) => {
                const jobs: Array<{ jobid: string; schedule: string; command: string }> = await tx.query(
                    "SELECT jobid, schedule, command FROM cron.job WHERE jobname = $1",
                    ["booking_reminder_tick"],
                )
                expect(jobs).toHaveLength(1)
                const [job] = jobs
                assert(job, "Apply the example's public-surface Supabase migration before integration proofs")
                expect(job.schedule).toBe("*/15 * * * *")
                expect(job.command.trim()).toBe("select private.booking_reminder_tick()")
                const first = await tx.query("SELECT cron.schedule($1, $2, $3) AS jobid", [
                    "booking_reminder_tick",
                    job.schedule,
                    job.command,
                ])
                const second = await tx.query("SELECT cron.schedule($1, $2, $3) AS jobid", [
                    "booking_reminder_tick",
                    job.schedule,
                    job.command,
                ])
                expect(first).toEqual(second)
                expect(
                    await tx.query("SELECT jobid FROM cron.job WHERE jobname = $1", ["booking_reminder_tick"]),
                ).toEqual([{ jobid: job.jobid }])
                const count = async () => {
                    const [row] = await tx.query<Array<{ count: string }>>(
                        "SELECT count(*) FROM pgmq.q_booking_reminder WHERE message->'payload'->>'tick' = 'true'",
                    )
                    return Number(row?.count)
                }
                const before = await count()
                await tx.query(job.command)
                expect(await count()).toBe(before + 1)
                throw rolledBack
            }),
        ).rejects.toBe(rolledBack)
    })
}

describe("lite queue (local Supabase integration)", () => {
    /** Actual Supabase PostgreSQL transactions and pgmq messages; use a disposable local CLI database. */
    const world = createQueueDatabaseWorld()

    const bookingIds: Array<string> = []
    const ids = fakeIds("a19")

    let transport: PgmqQueueTransportClient

    let producer: BookingReminderQueue

    const nextBooking = () => {
        const id = `proof-${ids.next()}`
        bookingIds.push(id)
        return id
    }

    beforeAll(async () => {
        await world.open()
        transport = new PgmqQueueTransportClient(options, world.manager, mock<Logger>())
        producer = new BookingReminderQueue(new QueueOutboxService(transport, new FakeClock()))
    })
    afterAll(async () => {
        try {
            if (world.isOpen) {
                await world.manager.query(
                    "DELETE FROM pgmq.q_booking_reminder WHERE message->'payload'->>'bookingId' = ANY($1::text[])",
                    [bookingIds],
                )
                await world.manager.query("DELETE FROM public.queue WHERE payload->>'bookingId' = ANY($1::text[])", [
                    bookingIds,
                ])
            }
        } finally {
            await world.close()
        }
    })
    const proof = () => ({ world, transport, producer, nextBooking })
    registerAtomicQueueProof(proof)
    registerRelayIdentityProof(proof)
    registerSchedulerProof(proof)
})
