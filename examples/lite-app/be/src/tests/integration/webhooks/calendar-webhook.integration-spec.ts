import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { FakeClock, fakeIds, mock } from "@starci/jest-preset"
import { CalendarInboxService } from "@modules/domain/calendar-inbox"
import { CalendarsService } from "@modules/domain/calendars"
import { Secret } from "@modules/platform/config"
import { HttpSecurityErrorCode } from "@modules/platform/http-security"
import type { HttpSecurityOptions } from "@modules/platform/http-security"
import type { JobClaims } from "@modules/platform/jobs"
import type { QueueOptions, RecordedJobRow } from "@modules/platform/queue"
import { CALENDAR_DELIVERY_QUEUE } from "@modules/queues/calendar-delivery"
import { useTestWorld } from "../../world"
import { createCalendarProof } from "../../world"

const clock = new FakeClock("2026-10-14T00:00:00.000Z")
const signingFixture = "integration-calendar-provider-fixture"
const payload = { id: "calendar-proof" }
const body = Buffer.from(JSON.stringify(payload))
const request = mock<RawBodyRequest<Request>>({ rawBody: body })
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

const doorOf = (inbox: CalendarInboxService) => world.modules.doorOf(inbox)

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
const world = useTestWorld({
    modules: (db) => createCalendarProof(db, clock, securityOptions, queueOptions),
    cleanup: async ({ builder, close }) => {
        try {
            await builder.cleanup(deliveryId)
        } finally {
            await close()
        }
    },
})

const deliveryId = `webhook-proof-${fakeIds().next()}`

const receiptIds: Array<string> = []

const committedHandoff = async (): Promise<RecordedJobRow> => {
    const receipts = await world.modules.receipts(deliveryId)
    receiptIds.push(...receipts.map((receipt) => receipt.id))
    expect(receipts).toHaveLength(1)
    expect(receipts[0]?.processed_at).toBeNull()
    const jobs = await world.modules.jobs(receiptIds)
    expect(jobs).toHaveLength(1)
    const [job] = jobs
    assert(job !== undefined, "Accepted calendar receipt must publish a typed queue outbox message")
    expect(job.payload).toEqual({ receiptId: receipts[0]?.id })
    expect(await world.modules.messages(job.id)).toEqual([{ message: { jobId: job.id, payload: job.payload } }])
    return job
}

const consumeCommittedReceipt = async (
    inbox: CalendarInboxService,
    calendars: CalendarsService,
    job: RecordedJobRow,
) => {
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    const processor = world.modules.processor(inbox, claims)
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
    expect(await world.modules.processed(job.payload.receiptId)).toEqual([{ processed: true }])
}

const registerCalendarHandoffProof = () => {
    it("webhooks/accepted-delivery-publishes-once: concurrent redeliveries commit one receipt and one typed job, then the deferred processor consumes once", async () => {
        const calendars = mock<CalendarsService>()
        calendars.acceptCalendarDelivery.mockResolvedValue(undefined)
        const inbox = world.modules.intake(calendars)
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
    registerCalendarHandoffProof()
})
