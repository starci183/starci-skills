import { createHmac, randomUUID } from "node:crypto"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { FakeClock, mock } from "@starci/jest-preset"
import { CalendarWebhook } from "@features/webhooks/calendar/transport/http/calendar.webhook"
import { CalendarDeliveryProcessor } from "@features/jobs/calendar-delivery/transport/queue/calendar-delivery.processor"
import { ProcessCalendarDeliveryStep } from "@features/jobs/calendar-delivery/steps/process-calendar-delivery.step"
import { CalendarInboxService } from "@modules/domain/calendar-inbox"
import { CalendarsService } from "@modules/domain/calendars"
import { Secret } from "@modules/platform/config"
import { WebhookSignatureService } from "@modules/platform/http-security/webhook-signature.service"
import type { HttpSecurityOptions } from "@modules/platform/http-security/http-security.options"
import { HttpSecurityErrorCode } from "@modules/platform/http-security/errors/http-security.error"
import type { JobClaims } from "@modules/platform/jobs"
import type { Logger } from "@modules/platform/logging"
import { PgmqQueueTransportClient } from "@modules/platform/queue/pgmq-queue-transport.client"
import { QueueOutboxService } from "@modules/platform/queue/queue-outbox.service"
import type { QueueOptions } from "@modules/platform/queue/queue.options"
import { CalendarDeliveryQueue, CALENDAR_DELIVERY_QUEUE } from "@modules/queues/calendar-delivery"
import { QueueDatabaseFixture } from "../../fixtures/queue.database.fixture"

const clock = new FakeClock("2026-10-14T00:00:00.000Z")
const signingFixture = "integration-calendar-provider-fixture"
const payload = { id: "calendar-proof" }
const body = Buffer.from(JSON.stringify(payload))
const request = { rawBody: body } as RawBodyRequest<Request>
const securityOptions: HttpSecurityOptions = {
    allowedOrigins: [],
    rateLimit: { windowMs: 60_000, defaultLimit: 100, strictLimit: 10 },
    webhooks: { calendar: { secret: new Secret(signingFixture), toleranceMs: 300_000 } },
}
const queueOptions: QueueOptions = {
    relayIntervalMs: 1,
    relayBatch: 20,
    concurrency: 1,
    pollIntervalMs: 1,
    visibilityTimeoutMs: 30_000,
    connections: [],
}

const signature = (timestamp: string, rawBody: Buffer = body): string => {
    const digest = createHmac("sha256", signingFixture).update(`${timestamp}.`).update(rawBody).digest("hex")
    return `sha256=${digest}`
}

const doorOf = (inbox: CalendarInboxService) =>
    new CalendarWebhook(new WebhookSignatureService(securityOptions, clock), inbox)

/** Signature and replay refusal use the actual door and verifier, with the untouched intake as the collaborator. */
describe("calendar webhook verification collaboration", () => {
    it("webhooks/bad-signature-is-refused: tampered bytes never reach the durable intake", async () => {
        const inbox = mock<CalendarInboxService>()
        const timestamp = String(clock.now().getTime())
        const door = doorOf(inbox)

        await expect(
            door.receive(request, signature(timestamp, Buffer.from("{}")), timestamp, "delivery-1", payload),
        ).rejects.toMatchObject({ code: HttpSecurityErrorCode.WebhookSignatureInvalid })

        expect(inbox.acceptCalendarDelivery).not.toHaveBeenCalled()
    })

    it("webhooks/replay-is-refused: a correctly signed delivery outside its replay window never claims an inbox row", async () => {
        const inbox = mock<CalendarInboxService>()
        const timestamp = String(clock.now().getTime() - 300_001)
        const door = doorOf(inbox)

        await expect(
            door.receive(request, signature(timestamp), timestamp, "delivery-1", payload),
        ).rejects.toMatchObject({ code: HttpSecurityErrorCode.WebhookReplayed })

        expect(inbox.acceptCalendarDelivery).not.toHaveBeenCalled()
    })
})

/** Real receipt/pgmq transactions prove concurrent intake dedupe and deferred, locked receipt consumption. */
const world = new QueueDatabaseFixture()

const deliveryId = `webhook-proof-${randomUUID()}`

const receiptIds: Array<string> = []

interface RecordedJob {
    readonly id: string
    readonly payload: { readonly receiptId: string }
}

const committedHandoff = async (): Promise<RecordedJob> => {
    const receipts: Array<{ id: string; processed_at: Date | null }> = await world.manager.query(
        "SELECT id, processed_at FROM public.calendar_inbox WHERE provider = $1 AND delivery_id = $2",
        ["calendar", deliveryId],
    )
    receiptIds.push(...receipts.map((receipt) => receipt.id))
    expect(receipts).toHaveLength(1)
    expect(receipts[0]?.processed_at).toBeNull()
    const jobs: Array<RecordedJob> = await world.manager.query(
        "SELECT id, payload FROM public.queue WHERE queue = $1 AND payload->>'receiptId' = ANY($2::text[])",
        [CALENDAR_DELIVERY_QUEUE, receiptIds],
    )
    expect(jobs).toHaveLength(1)
    const [job] = jobs
    if (!job) throw new Error("Accepted calendar receipt must publish a typed queue outbox message")
    expect(job.payload).toEqual({ receiptId: receipts[0]?.id })
    expect(
        await world.manager.query("SELECT message FROM pgmq.q_calendar_delivery WHERE message->>'jobId' = $1", [
            job.id,
        ]),
    ).toEqual([{ message: { jobId: job.id, payload: job.payload } }])
    return job
}

const consumeCommittedReceipt = async (inbox: CalendarInboxService, calendars: CalendarsService, job: RecordedJob) => {
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    const processor = new CalendarDeliveryProcessor(new ProcessCalendarDeliveryStep(inbox, claims))
    const delivery = {
        jobId: job.id,
        kind: CALENDAR_DELIVERY_QUEUE,
        fencingToken: 1,
        currentStep: null,
        payload: job.payload,
    }
    await Promise.all([processor.process(delivery), processor.process(delivery)])

    expect(calendars.acceptCalendarDelivery).toHaveBeenCalledTimes(1)
    expect(calendars.acceptCalendarDelivery).toHaveBeenCalledWith(payload, expect.any(Object))
    expect(
        await world.manager.query(
            "SELECT processed_at IS NOT NULL AS processed FROM public.calendar_inbox WHERE id = $1",
            [job.payload.receiptId],
        ),
    ).toEqual([{ processed: true }])
}

const registerCalendarHandoffProof = () => {
    it("webhooks/accepted-delivery-publishes-once: concurrent redeliveries commit one receipt and one typed job, then the deferred processor consumes once", async () => {
        const calendars = mock<CalendarsService>()
        calendars.acceptCalendarDelivery.mockResolvedValue(undefined)
        const transport = new PgmqQueueTransportClient(queueOptions, world.manager, mock<Logger>())
        const queue = new CalendarDeliveryQueue(new QueueOutboxService(transport, clock))
        const inbox = new CalendarInboxService(world.manager, queue, calendars)
        const door = doorOf(inbox)
        const timestamp = String(clock.now().getTime())

        await Promise.all([
            door.receive(request, signature(timestamp), timestamp, deliveryId, payload),
            door.receive(request, signature(timestamp), timestamp, deliveryId, payload),
        ])

        expect(calendars.acceptCalendarDelivery).not.toHaveBeenCalled()
        const job = await committedHandoff()
        await consumeCommittedReceipt(inbox, calendars, job)
    })
}

describe("calendar webhook handoff (local Supabase integration)", () => {
    beforeAll(async () => {
        await world.open()
    })
    afterAll(async () => {
        try {
            if (world.isOpen) {
                const receipts: Array<{ id: string }> = await world.manager.query(
                    "SELECT id FROM public.calendar_inbox WHERE provider = $1 AND delivery_id = $2",
                    ["calendar", deliveryId],
                )
                const cleanupIds = receipts.map((receipt) => receipt.id)
                await world.manager.query(
                    "DELETE FROM pgmq.q_calendar_delivery WHERE message->'payload'->>'receiptId' = ANY($1::text[])",
                    [cleanupIds],
                )
                await world.manager.query(
                    "DELETE FROM public.queue WHERE queue = $1 AND payload->>'receiptId' = ANY($2::text[])",
                    [CALENDAR_DELIVERY_QUEUE, cleanupIds],
                )
                await world.manager.query(
                    "DELETE FROM public.calendar_inbox WHERE provider = $1 AND delivery_id = $2",
                    ["calendar", deliveryId],
                )
            }
        } finally {
            await world.close()
        }
    })
    registerCalendarHandoffProof()
})
