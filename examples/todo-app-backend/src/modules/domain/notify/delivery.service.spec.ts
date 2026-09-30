import { mock } from "@starci/jest-preset/mock"
import { NotifySmtpError, NotifySmtpErrorCode } from "@modules/integrations/notify-smtp"
import type { NotifySmtpClient } from "@modules/integrations/notify-smtp"
import type { Logger } from "@modules/platform/logging"
import { mockEntityManager } from "@tests/fixtures/database"
import { DeliveryService } from "./delivery.service"
import { RETRY_BUDGET } from "./notify.policy"
import { NotifyDeliveryAttemptEntity } from "./persistence/entities/delivery-attempt.entity"

const AT = new Date("2026-09-30T10:00:00.000Z")
const ISO = AT.toISOString()
const MESSAGE = { to: "p1", subject: "s", body: "b" }

const attemptRow = (overrides: Partial<NotifyDeliveryAttemptEntity> = {}): NotifyDeliveryAttemptEntity =>
    Object.assign(new NotifyDeliveryAttemptEntity(), {
        notificationId: "n1",
        state: "queued" as const,
        attempt: 0,
        failureClass: null,
        startedAt: null,
        endedAt: null,
        history: [{ state: "queued" as const, at: ISO }],
        ...overrides,
    })

const echoSave = jest.fn().mockImplementation((_target: unknown, entity: object) => Promise.resolve(entity))

const build = (smtp: Partial<NotifySmtpClient> = {}) => {
    const logger = mock<Logger>()
    const service = new DeliveryService(mockEntityManager(), mock<NotifySmtpClient>(smtp), logger)
    return { service, logger }
}

describe("DeliveryService", () => {
    it("creates a queued attempt with a one-step history", async () => {
        const manager = mockEntityManager({ save: echoSave })
        const { service } = build()
        const view = await service.admit({ manager, notificationId: "n1", at: AT, unsubscribed: false })
        expect(view).toMatchObject({ state: "queued", attempt: 0, failureClass: null, endedAt: null })
        expect(view.history).toEqual([{ state: "queued", at: ISO }])
    })

    it("creates the attempt of an unsubscribed recipient already suppressed and ended", async () => {
        const manager = mockEntityManager({ save: echoSave })
        const { service } = build()
        const view = await service.admit({ manager, notificationId: "n1", at: AT, unsubscribed: true })
        expect(view).toMatchObject({ state: "suppressed", failureClass: "unsubscribed", endedAt: AT })
        expect(view.history.map((step) => step.state)).toEqual(["queued", "suppressed"])
    })

    it("moves only queued attempts to sending and counts the dispatch", async () => {
        const manager = mockEntityManager({
            find: jest.fn().mockResolvedValue([attemptRow(), attemptRow({ notificationId: "n2", state: "delivered" })]),
            save: echoSave,
        })
        const { service } = build()
        const sending = await service.markSending({ manager, notificationIds: ["n1", "n2"], at: AT })
        expect(sending).toHaveLength(1)
        expect(sending[0]).toMatchObject({ notificationId: "n1", state: "sending", attempt: 1, startedAt: AT })
        expect(sending[0]?.history.map((step) => step.state)).toEqual(["queued", "sending"])
    })

    it("writes nothing when the batch is empty or has no queued attempt", async () => {
        const manager = mockEntityManager({
            find: jest.fn().mockResolvedValue([attemptRow({ state: "delivered" })]),
            save: jest.fn(),
        })
        const { service } = build()
        await expect(service.markSending({ manager, notificationIds: [], at: AT })).resolves.toEqual([])
        await expect(service.markSending({ manager, notificationIds: ["n1"], at: AT })).resolves.toEqual([])
        expect(manager.save).not.toHaveBeenCalled()
    })

    it("answers delivered when the mail host accepts the message", async () => {
        const send = jest.fn().mockResolvedValue(undefined)
        const { service } = build({ send })
        await expect(service.transmit(MESSAGE)).resolves.toBe("delivered")
        expect(send).toHaveBeenCalledWith(MESSAGE)
    })

    it("classifies a permanent rejection, a transient failure and an unexpected error", async () => {
        const rejected = new NotifySmtpError({ code: NotifySmtpErrorCode.PermanentRejection, params: { reason: "550" } })
        const busy = new NotifySmtpError({ code: NotifySmtpErrorCode.TransientFailure, params: { reason: "450" } })
        await expect(build({ send: jest.fn().mockRejectedValue(rejected) }).service.transmit(MESSAGE)).resolves.toBe("permanent-bounce")
        await expect(build({ send: jest.fn().mockRejectedValue(busy) }).service.transmit(MESSAGE)).resolves.toBe("transient")
        const unexpected = build({ send: jest.fn().mockRejectedValue(new TypeError("boom")) })
        await expect(unexpected.service.transmit(MESSAGE)).resolves.toBe("transient")
        expect(unexpected.logger.error).toHaveBeenCalled()
    })

    it("marks a sending attempt delivered and ends it", async () => {
        const manager = mockEntityManager({
            find: jest.fn().mockResolvedValue([attemptRow({ state: "sending", attempt: 1 })]),
            save: echoSave,
        })
        const { service } = build()
        const recorded = await service.record({ manager, notificationIds: ["n1"], verdict: "delivered", at: AT })
        expect(recorded).toEqual({ delivered: ["n1"], retried: [], bounced: [], attempt: 1 })
        expect(manager.save).toHaveBeenCalledWith(
            NotifyDeliveryAttemptEntity,
            [expect.objectContaining({ state: "delivered", endedAt: AT })],
        )
    })

    it("bounces a permanent rejection with its failure class", async () => {
        const manager = mockEntityManager({
            find: jest.fn().mockResolvedValue([attemptRow({ state: "sending", attempt: 1 })]),
            save: echoSave,
        })
        const recorded = await build().service.record({ manager, notificationIds: ["n1"], verdict: "permanent-bounce", at: AT })
        expect(recorded.bounced).toEqual(["n1"])
        expect(manager.save).toHaveBeenCalledWith(
            NotifyDeliveryAttemptEntity,
            [expect.objectContaining({ state: "bounced", failureClass: "permanent-bounce", endedAt: AT })],
        )
    })

    it("re-queues a transient failure while the budget lasts and bounces it once the budget is spent", async () => {
        const retry = mockEntityManager({
            find: jest.fn().mockResolvedValue([attemptRow({ state: "sending", attempt: 1 })]),
            save: echoSave,
        })
        const first = await build().service.record({ manager: retry, notificationIds: ["n1"], verdict: "transient", at: AT })
        expect(first).toMatchObject({ retried: ["n1"], bounced: [], attempt: 1 })
        expect(retry.save).toHaveBeenCalledWith(
            NotifyDeliveryAttemptEntity,
            [expect.objectContaining({ state: "queued", failureClass: "transient", endedAt: null })],
        )

        const spent = mockEntityManager({
            find: jest.fn().mockResolvedValue([attemptRow({ state: "sending", attempt: RETRY_BUDGET })]),
            save: echoSave,
        })
        const last = await build().service.record({ manager: spent, notificationIds: ["n1"], verdict: "transient", at: AT })
        expect(last).toMatchObject({ retried: [], bounced: ["n1"] })
        expect(spent.save).toHaveBeenCalledWith(
            NotifyDeliveryAttemptEntity,
            [expect.objectContaining({ state: "bounced", failureClass: "retries-exhausted", endedAt: AT })],
        )
    })

    it("leaves attempts that are not sending untouched", async () => {
        const manager = mockEntityManager({
            find: jest.fn().mockResolvedValue([attemptRow({ state: "suppressed" })]),
            save: jest.fn(),
        })
        const recorded = await build().service.record({ manager, notificationIds: ["n1"], verdict: "delivered", at: AT })
        expect(recorded).toEqual({ delivered: [], retried: [], bounced: [], attempt: 0 })
        expect(manager.save).not.toHaveBeenCalled()
    })

    it("reads one attempt by notification id and answers null for an unknown one", async () => {
        const own = mockEntityManager({ findOneBy: jest.fn().mockResolvedValueOnce(attemptRow()).mockResolvedValueOnce(null) })
        const service = new DeliveryService(own, mock<NotifySmtpClient>(), mock<Logger>())
        await expect(service.find({ notificationId: "n1" })).resolves.toMatchObject({ notificationId: "n1" })
        await expect(service.find({ notificationId: "nope" })).resolves.toBeNull()
        expect(own.findOneBy).toHaveBeenCalledWith(NotifyDeliveryAttemptEntity, { notificationId: "n1" })
    })
})
