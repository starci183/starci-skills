import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { NOTIFY_SMTP_CLIENT, NotifySmtpError, NotifySmtpErrorCode } from "@modules/integrations/notify-smtp"
import type { NotifySmtpClient } from "@modules/integrations/notify-smtp"
import { LIST_ROWS_MAX, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { In } from "typeorm"
import { DeliveryService } from "./delivery.service"
import { NotifyLogEvent } from "./notify.log-events"
import { NotifyDeliveryAttemptEntity } from "./persistence/entities/delivery-attempt.entity"

const AT = new Date("2026-09-30T10:00:00.000Z")
const EARLIER = new Date("2026-09-30T09:00:00.000Z")
const AT_ISO = AT.toISOString()

const attempt = (overrides: Partial<NotifyDeliveryAttemptEntity> = {}): NotifyDeliveryAttemptEntity =>
    Object.assign(new NotifyDeliveryAttemptEntity(), {
        notificationId: "n1",
        state: "queued",
        attempt: 0,
        failureClass: null,
        startedAt: null,
        endedAt: null,
        history: [{ state: "queued", at: EARLIER.toISOString() }],
        ...overrides,
    })

const build = async (stored = mockEntityManager()) => {
    const smtp = mock<NotifySmtpClient>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DeliveryService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: stored },
            { provide: NOTIFY_SMTP_CLIENT, useValue: smtp },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(DeliveryService), stored, smtp, logger }
}

describe("DeliveryService", () => {
    describe("admit", () => {
        it("creates a queued attempt with the queued step in its history", async () => {
            const { service } = await build()
            const created = attempt({ history: [{ state: "queued", at: AT_ISO }] })
            const manager = mockEntityManager({ save: [NotifyDeliveryAttemptEntity, created] })

            const view = await service.admit({ manager, notificationId: "n1", at: AT, unsubscribed: false })

            expect(view.state).toBe("queued")
            expect(view.history).toEqual([{ state: "queued", at: AT_ISO }])
            expect(manager.save).toHaveBeenCalledWith(NotifyDeliveryAttemptEntity, {
                notificationId: "n1",
                state: "queued",
                attempt: 0,
                failureClass: null,
                startedAt: null,
                endedAt: null,
                history: [{ state: "queued", at: AT_ISO }],
            })
        })

        it("creates an already suppressed attempt for an unsubscribed recipient", async () => {
            const { service } = await build()
            const created = attempt({ state: "suppressed", failureClass: "unsubscribed", endedAt: AT })
            const manager = mockEntityManager({ save: [NotifyDeliveryAttemptEntity, created] })

            const view = await service.admit({ manager, notificationId: "n1", at: AT, unsubscribed: true })

            expect(view).toMatchObject({ state: "suppressed", failureClass: "unsubscribed", endedAt: AT })
            expect(manager.save).toHaveBeenCalledWith(NotifyDeliveryAttemptEntity, {
                notificationId: "n1",
                state: "suppressed",
                attempt: 0,
                failureClass: "unsubscribed",
                startedAt: null,
                endedAt: AT,
                history: [
                    { state: "queued", at: AT_ISO },
                    { state: "suppressed", at: AT_ISO, failureClass: "unsubscribed" },
                ],
            })
        })
    })

    describe("find", () => {
        it("reads the attempt of a notification", async () => {
            const { service, stored } = await build(
                mockEntityManager({ findOneBy: [NotifyDeliveryAttemptEntity, attempt({ state: "delivered", attempt: 1 })] }),
            )

            await expect(service.find({ notificationId: "n1" })).resolves.toMatchObject({
                notificationId: "n1",
                state: "delivered",
                attempt: 1,
            })
            expect(stored.findOneBy).toHaveBeenCalledWith(NotifyDeliveryAttemptEntity, { notificationId: "n1" })
        })

        it("answers null when the notification has no attempt", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [NotifyDeliveryAttemptEntity, null] }))

            await expect(service.find({ notificationId: "n9" })).resolves.toBeNull()
        })
    })

    describe("markSending", () => {
        it("answers an empty batch without reading", async () => {
            const { service } = await build()
            const manager = mockEntityManager()

            await expect(service.markSending({ manager, notificationIds: [], at: AT })).resolves.toEqual([])
        })

        it("moves queued attempts to sending, counts the dispatch and keeps an earlier start", async () => {
            const { service } = await build()
            const fresh = attempt({ notificationId: "n1" })
            const retried = attempt({ notificationId: "n2", attempt: 1, startedAt: EARLIER })
            const sent = [
                attempt({ notificationId: "n1", state: "sending", attempt: 1, startedAt: AT }),
                attempt({ notificationId: "n2", state: "sending", attempt: 2, startedAt: EARLIER }),
            ]
            const manager = mockEntityManager({
                find: [NotifyDeliveryAttemptEntity, [fresh, retried]],
                save: [NotifyDeliveryAttemptEntity, sent],
            })

            const views = await service.markSending({ manager, notificationIds: ["n1", "n2"], at: AT })

            expect(views.map((view) => [view.notificationId, view.state, view.attempt])).toEqual([
                ["n1", "sending", 1],
                ["n2", "sending", 2],
            ])
            expect(manager.find).toHaveBeenCalledWith(NotifyDeliveryAttemptEntity, {
                where: { notificationId: In(["n1", "n2"]) },
                take: LIST_ROWS_MAX,
            })
            expect(manager.save).toHaveBeenCalledWith(NotifyDeliveryAttemptEntity, [
                {
                    ...fresh,
                    state: "sending",
                    attempt: 1,
                    startedAt: AT,
                    history: [...fresh.history, { state: "sending", at: AT_ISO }],
                },
                {
                    ...retried,
                    state: "sending",
                    attempt: 2,
                    startedAt: EARLIER,
                    history: [...retried.history, { state: "sending", at: AT_ISO }],
                },
            ])
        })

        it("leaves attempts in any other state alone and saves nothing when none is queued", async () => {
            const { service } = await build()
            const manager = mockEntityManager({
                find: [NotifyDeliveryAttemptEntity, [attempt({ state: "delivered" }), attempt({ state: "sending" })]],
            })

            await expect(service.markSending({ manager, notificationIds: ["n1"], at: AT })).resolves.toEqual([])
            expect(manager.save).not.toHaveBeenCalled()
        })
    })

    describe("transmit", () => {
        const message = { to: "p1", subject: "Subject", body: "Body" }

        it("answers delivered when the mail host accepts the message", async () => {
            const { service, smtp, logger } = await build()
            smtp.send.mockResolvedValue(undefined)

            await expect(service.transmit(message)).resolves.toBe("delivered")

            expect(smtp.send).toHaveBeenCalledWith(message)
            expect(logger.warn).not.toHaveBeenCalled()
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("answers permanent-bounce and logs the reason when the mail host rejects the address for good", async () => {
            const { service, smtp, logger } = await build()
            smtp.send.mockRejectedValue(
                new NotifySmtpError({ code: NotifySmtpErrorCode.PermanentRejection, params: { reason: "550 no such user" } }),
            )

            await expect(service.transmit(message)).resolves.toBe("permanent-bounce")

            expect(logger.warn).toHaveBeenCalledWith(NotifyLogEvent.SendRejected, { reason: "550 no such user" })
        })

        it("logs an empty reason for a permanent rejection that names none", async () => {
            const { service, smtp, logger } = await build()
            smtp.send.mockRejectedValue(new NotifySmtpError({ code: NotifySmtpErrorCode.PermanentRejection }))

            await expect(service.transmit(message)).resolves.toBe("permanent-bounce")

            expect(logger.warn).toHaveBeenCalledWith(NotifyLogEvent.SendRejected, { reason: "" })
        })

        it("answers transient and logs the reason when the mail host is unavailable", async () => {
            const { service, smtp, logger } = await build()
            smtp.send.mockRejectedValue(
                new NotifySmtpError({ code: NotifySmtpErrorCode.TransientFailure, params: { reason: "timeout" } }),
            )

            await expect(service.transmit(message)).resolves.toBe("transient")

            expect(logger.warn).toHaveBeenCalledWith(NotifyLogEvent.SendFailed, { reason: "timeout" })
        })

        it("logs an empty reason for a transient failure that names none", async () => {
            const { service, smtp, logger } = await build()
            smtp.send.mockRejectedValue(new NotifySmtpError({ code: NotifySmtpErrorCode.TransientFailure }))

            await expect(service.transmit(message)).resolves.toBe("transient")

            expect(logger.warn).toHaveBeenCalledWith(NotifyLogEvent.SendFailed, { reason: "" })
        })

        it("answers transient and logs the error when the client fails with something unexpected", async () => {
            const { service, smtp, logger } = await build()
            const failure = new TypeError("socket closed")
            smtp.send.mockRejectedValue(failure)

            await expect(service.transmit(message)).resolves.toBe("transient")

            expect(logger.error).toHaveBeenCalledWith(NotifyLogEvent.SendFailed, failure)
            expect(logger.warn).not.toHaveBeenCalled()
        })
    })

    describe("record", () => {
        const sending = (overrides: Partial<NotifyDeliveryAttemptEntity> = {}) =>
            attempt({
                state: "sending",
                attempt: 1,
                startedAt: EARLIER,
                history: [
                    { state: "queued", at: EARLIER.toISOString() },
                    { state: "sending", at: EARLIER.toISOString() },
                ],
                ...overrides,
            })

        it("answers an empty settlement for an empty batch without reading", async () => {
            const { service } = await build()
            const manager = mockEntityManager()

            await expect(
                service.record({ manager, notificationIds: [], verdict: "delivered", at: AT }),
            ).resolves.toEqual({ delivered: [], retried: [], bounced: [], attempt: 0 })
        })

        it("marks a delivered send as delivered, ended now, and keeps the recorded failure class", async () => {
            const { service } = await build()
            const row = sending({ failureClass: "transient" })
            const manager = mockEntityManager({
                find: [NotifyDeliveryAttemptEntity, [row]],
                save: [NotifyDeliveryAttemptEntity, [row]],
            })

            const recorded = await service.record({ manager, notificationIds: ["n1"], verdict: "delivered", at: AT })

            expect(recorded).toEqual({ delivered: ["n1"], retried: [], bounced: [], attempt: 1 })
            expect(manager.find).toHaveBeenCalledWith(NotifyDeliveryAttemptEntity, {
                where: { notificationId: In(["n1"]) },
                take: LIST_ROWS_MAX,
            })
            expect(manager.save).toHaveBeenCalledWith(NotifyDeliveryAttemptEntity, [
                {
                    ...row,
                    state: "delivered",
                    failureClass: "transient",
                    endedAt: AT,
                    history: [...row.history, { state: "delivered", at: AT_ISO }],
                },
            ])
        })

        it("sends a transient failure back to queued while the retry budget lasts", async () => {
            const { service } = await build()
            const row = sending({ attempt: 2 })
            const manager = mockEntityManager({
                find: [NotifyDeliveryAttemptEntity, [row]],
                save: [NotifyDeliveryAttemptEntity, [row]],
            })

            const recorded = await service.record({ manager, notificationIds: ["n1"], verdict: "transient", at: AT })

            expect(recorded).toEqual({ delivered: [], retried: ["n1"], bounced: [], attempt: 2 })
            expect(manager.save).toHaveBeenCalledWith(NotifyDeliveryAttemptEntity, [
                {
                    ...row,
                    state: "queued",
                    failureClass: "transient",
                    endedAt: null,
                    history: [...row.history, { state: "queued", at: AT_ISO, failureClass: "transient" }],
                },
            ])
        })

        it("bounces a transient failure as retries-exhausted once the third dispatch failed", async () => {
            const { service } = await build()
            const row = sending({ attempt: 3 })
            const manager = mockEntityManager({
                find: [NotifyDeliveryAttemptEntity, [row]],
                save: [NotifyDeliveryAttemptEntity, [row]],
            })

            const recorded = await service.record({ manager, notificationIds: ["n1"], verdict: "transient", at: AT })

            expect(recorded).toEqual({ delivered: [], retried: [], bounced: ["n1"], attempt: 3 })
            expect(manager.save).toHaveBeenCalledWith(NotifyDeliveryAttemptEntity, [
                expect.objectContaining({ state: "bounced", failureClass: "retries-exhausted", endedAt: AT }),
            ])
        })

        it("bounces a permanent rejection at once and reports the highest attempt of the batch", async () => {
            const { service } = await build()
            const rows = [sending({ notificationId: "n1", attempt: 1 }), sending({ notificationId: "n2", attempt: 2 })]
            const manager = mockEntityManager({
                find: [NotifyDeliveryAttemptEntity, rows],
                save: [NotifyDeliveryAttemptEntity, rows],
            })

            const recorded = await service.record({
                manager,
                notificationIds: ["n1", "n2"],
                verdict: "permanent-bounce",
                at: AT,
            })

            expect(recorded).toEqual({ delivered: [], retried: [], bounced: ["n1", "n2"], attempt: 2 })
            expect(manager.save).toHaveBeenCalledWith(NotifyDeliveryAttemptEntity, [
                expect.objectContaining({ notificationId: "n1", state: "bounced", failureClass: "permanent-bounce" }),
                expect.objectContaining({ notificationId: "n2", state: "bounced", failureClass: "permanent-bounce" }),
            ])
        })

        it("settles only the attempts that are still sending and saves nothing when none is", async () => {
            const { service } = await build()
            const manager = mockEntityManager({
                find: [NotifyDeliveryAttemptEntity, [attempt({ state: "delivered" }), attempt({ state: "queued" })]],
            })

            await expect(
                service.record({ manager, notificationIds: ["n1"], verdict: "delivered", at: AT }),
            ).resolves.toEqual({ delivered: [], retried: [], bounced: [], attempt: 0 })
            expect(manager.save).not.toHaveBeenCalled()
        })
    })
})
