import { mock } from "@starci/jest-preset/mock"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { Outbox } from "@modules/platform/outbox"
import { mockEntityManager } from "@tests/fixtures/database"
import type { DedupeService } from "./dedupe.service"
import type { DeliveryService } from "./delivery.service"
import type { DigestService } from "./digest.service"
import { NotifyErrorCode } from "./errors/notify.error"
import type { DeliveryAttemptView, NotificationView } from "./notify.contracts"
import { NotifyService } from "./notify.service"
import type { PreferencesService } from "./preferences.service"

const AT = new Date("2026-09-30T10:00:00.000Z")
const CLOSES_AT = new Date("2026-09-30T10:10:00.000Z")
const MINUTE = 60_000

const notification = (overrides: Partial<NotificationView> = {}): NotificationView => ({
    id: "n1",
    kind: "task-complete",
    recipientId: "p1",
    payload: { taskId: "t1" },
    digestGroupId: "w1",
    createdAt: AT,
    ...overrides,
})

const attempt = (overrides: Partial<DeliveryAttemptView> = {}): DeliveryAttemptView => ({
    notificationId: "n1",
    state: "queued",
    attempt: 0,
    failureClass: null,
    startedAt: null,
    endedAt: null,
    history: [],
    ...overrides,
})

interface Parts {
    readonly isNew?: boolean
    readonly unsubscribed?: boolean
    readonly windowMinutes?: number | null
    readonly opened?: boolean
}

const build = (parts: Parts = {}) => {
    const inner = mockEntityManager()
    const catalog = mock<MessageCatalog>({
        get: jest.fn().mockImplementation((key: string, params: object) => `${key} ${JSON.stringify(params)}`),
    })
    const outbox = mock<Outbox>()
    const dedupe = mock<DedupeService>({
        admit: jest.fn().mockResolvedValue({ notification: notification(), isNew: parts.isNew ?? true }),
        findByDigestGroup: jest.fn().mockResolvedValue([notification()]),
    })
    const digest = mock<DigestService>({
        admit: jest.fn().mockResolvedValue({ windowId: "w1", opened: parts.opened ?? true, closesAt: CLOSES_AT }),
        flush: jest.fn().mockResolvedValue({ windowId: "w1", personId: "p1", channel: "email" }),
    })
    const preferences = mock<PreferencesService>({
        get: jest.fn().mockResolvedValue({
            personId: "p1",
            channel: "email",
            unsubscribed: parts.unsubscribed ?? false,
            digestWindowMinutes: parts.windowMinutes ?? null,
        }),
    })
    const delivery = mock<DeliveryService>({
        admit: jest
            .fn()
            .mockResolvedValue(attempt({ state: parts.unsubscribed ? "suppressed" : "queued" })),
        find: jest.fn().mockResolvedValue(attempt({ state: "delivered" })),
        markSending: jest.fn().mockResolvedValue([attempt({ state: "sending", attempt: 1 })]),
        transmit: jest.fn().mockResolvedValue("delivered"),
        record: jest.fn().mockResolvedValue({ delivered: ["n1"], retried: [], bounced: [], attempt: 1 }),
    })
    const service = new NotifyService(catalog, outbox, dedupe, digest, preferences, delivery)
    return { service, inner, catalog, outbox, dedupe, digest, preferences, delivery }
}

const admitParams = (manager: ReturnType<typeof mockEntityManager>) => ({
    manager,
    kind: "task-complete",
    sourceEventId: "evt-1",
    recipientId: "p1",
    channel: "email",
    payload: { taskId: "t1" },
    at: AT,
})

describe("NotifyService.admit", () => {
    it("queues a delivery, joins the window and writes the one flush message when the window opens", async () => {
        const { service, inner, digest, dedupe, outbox } = build()
        const result = await service.admit(admitParams(inner))
        expect(result).toEqual({
            kind: "ok",
            value: { notificationId: "n1", isNew: true, deliveryState: "queued" },
        })
        expect(digest.admit).toHaveBeenCalledWith({ manager: inner, personId: "p1", channel: "email", at: AT, windowMinutes: 10 })
        expect(dedupe.assignDigestGroup).toHaveBeenCalledWith({ manager: inner, id: "n1", digestGroupId: "w1" })
        expect(outbox.enqueue).toHaveBeenCalledTimes(1)
        expect(outbox.enqueue).toHaveBeenCalledWith(inner, {
            queue: "notify.dispatch",
            eventId: "notify-flush:w1",
            payload: { kind: "flush", groupId: "w1" },
            availableAt: CLOSES_AT,
        })
    })

    it("joins an open window without scheduling a second flush", async () => {
        const { service, inner, outbox } = build({ opened: false })
        await service.admit(admitParams(inner))
        expect(outbox.enqueue).not.toHaveBeenCalled()
    })

    it("opens the window with the length of the preference override", async () => {
        const { service, inner, digest } = build({ windowMinutes: 3 })
        await service.admit(admitParams(inner))
        expect(digest.admit).toHaveBeenCalledWith(expect.objectContaining({ windowMinutes: 3 }))
    })

    it("suppresses an unsubscribed recipient before any window or send", async () => {
        const { service, inner, digest, dedupe, delivery, outbox } = build({ unsubscribed: true })
        const result = await service.admit(admitParams(inner))
        expect(result).toEqual({
            kind: "ok",
            value: { notificationId: "n1", isNew: true, deliveryState: "suppressed" },
        })
        expect(delivery.admit).toHaveBeenCalledWith(expect.objectContaining({ unsubscribed: true }))
        expect(digest.admit).not.toHaveBeenCalled()
        expect(dedupe.assignDigestGroup).not.toHaveBeenCalled()
        expect(outbox.enqueue).not.toHaveBeenCalled()
    })

    it("reads back the first decision for a repeated event and writes nothing", async () => {
        const { service, inner, preferences, delivery, digest, outbox } = build({ isNew: false })
        const result = await service.admit(admitParams(inner))
        expect(result).toEqual({
            kind: "ok",
            value: { notificationId: "n1", isNew: false, deliveryState: "delivered" },
        })
        expect(preferences.get).not.toHaveBeenCalled()
        expect(delivery.admit).not.toHaveBeenCalled()
        expect(digest.admit).not.toHaveBeenCalled()
        expect(outbox.enqueue).not.toHaveBeenCalled()
    })

    it("reports queued for a repeated event whose attempt row is gone", async () => {
        const { service, inner, delivery } = build({ isNew: false })
        jest.mocked(delivery.find).mockResolvedValue(null)
        await expect(service.admit(admitParams(inner))).resolves.toMatchObject({
            kind: "ok",
            value: { isNew: false, deliveryState: "queued" },
        })
    })
})

describe("NotifyService.admit refusals", () => {
    it("refuses a blank channel and writes nothing", async () => {
        const { service, inner, dedupe, outbox } = build()
        const result = await service.admit({ ...admitParams(inner), channel: "  " })
        expect(result).toMatchObject({ kind: "refused", code: NotifyErrorCode.ChannelRequired })
        expect(dedupe.admit).not.toHaveBeenCalled()
        expect(outbox.enqueue).not.toHaveBeenCalled()
    })
})

describe("NotifyService dispatch", () => {
    it("flushes the closed window, marks the queued attempts sending and renders one message naming the task", async () => {
        const { service, inner, digest, delivery, catalog } = build()
        const plan = await service.prepareDispatch({ manager: inner, kind: "flush", groupId: "w1", at: AT })
        expect(digest.flush).toHaveBeenCalledWith({ manager: inner, windowId: "w1", at: AT })
        expect(delivery.markSending).toHaveBeenCalledWith({ manager: inner, notificationIds: ["n1"], at: AT })
        expect(plan?.notificationIds).toEqual(["n1"])
        expect(plan?.message.to).toBe("p1")
        expect(catalog.get).toHaveBeenCalledWith("notify.email.task-complete.subject", { taskId: "t1" }, "vi")
        expect(plan?.message.subject).toContain("notify.email.task-complete.subject")
    })

    it("renders the generic subject for another kind and an empty task id when the payload has none", async () => {
        const { service, inner, dedupe, catalog } = build()
        jest.mocked(dedupe.findByDigestGroup).mockResolvedValue([notification({ kind: "new-device" })])
        await service.prepareDispatch({ manager: inner, kind: "retry", groupId: "w1", at: AT })
        expect(catalog.get).toHaveBeenCalledWith("notify.email.generic.subject", { kind: "new-device" }, "vi")
        jest.mocked(dedupe.findByDigestGroup).mockResolvedValue([notification({ payload: {} })])
        await service.prepareDispatch({ manager: inner, kind: "retry", groupId: "w1", at: AT })
        expect(catalog.get).toHaveBeenCalledWith("notify.email.task-complete.subject", { taskId: "" }, "vi")
    })

    it("collapses a group of several notifications into one digest message", async () => {
        const { service, inner, dedupe, catalog } = build()
        jest.mocked(dedupe.findByDigestGroup).mockResolvedValue([
            notification(),
            notification({ id: "n2", payload: { taskId: "t2" }, createdAt: new Date(AT.getTime() + MINUTE) }),
        ])
        const plan = await service.prepareDispatch({ manager: inner, kind: "flush", groupId: "w1", at: AT })
        expect(catalog.get).toHaveBeenCalledWith("notify.email.digest.subject", { count: 2 }, "vi")
        expect(plan?.message.body.split("\n")).toHaveLength(2)
    })

    it("does not flush for a retry", async () => {
        const { service, inner, digest } = build()
        await service.prepareDispatch({ manager: inner, kind: "retry", groupId: "w1", at: AT })
        expect(digest.flush).not.toHaveBeenCalled()
    })

    it("answers null and marks nothing when the window is not flushable", async () => {
        const { service, inner, digest, delivery } = build()
        jest.mocked(digest.flush).mockResolvedValue(null)
        await expect(service.prepareDispatch({ manager: inner, kind: "flush", groupId: "w1", at: AT })).resolves.toBeNull()
        expect(delivery.markSending).not.toHaveBeenCalled()
    })

    it("answers null for an empty group and for a group with no queued attempt", async () => {
        const { service, inner, dedupe, delivery } = build()
        jest.mocked(dedupe.findByDigestGroup).mockResolvedValueOnce([])
        await expect(service.prepareDispatch({ manager: inner, kind: "retry", groupId: "w1", at: AT })).resolves.toBeNull()
        jest.mocked(delivery.markSending).mockResolvedValueOnce([])
        await expect(service.prepareDispatch({ manager: inner, kind: "retry", groupId: "w1", at: AT })).resolves.toBeNull()
    })

    it("transmits the rendered message and answers the verdict", async () => {
        const { service, delivery } = build()
        const message = { to: "p1", subject: "s", body: "b" }
        await expect(service.transmit({ notificationIds: ["n1"], groupId: "w1", message })).resolves.toBe("delivered")
        expect(delivery.transmit).toHaveBeenCalledWith(message)
    })

    it("settles a delivered send without writing a retry", async () => {
        const { service, inner, outbox, delivery } = build()
        const plan = { notificationIds: ["n1"], groupId: "w1", message: { to: "p1", subject: "s", body: "b" } }
        const result = await service.settle({ manager: inner, plan, verdict: "delivered", at: AT })
        expect(result).toEqual({ delivered: 1, retried: 0, bounced: 0 })
        expect(delivery.record).toHaveBeenCalledWith({ manager: inner, notificationIds: ["n1"], verdict: "delivered", at: AT })
        expect(outbox.enqueue).not.toHaveBeenCalled()
    })

    it("writes one retry message thirty seconds out, keyed by group and attempt, when attempts go back to queued", async () => {
        const { service, inner, outbox, delivery } = build()
        jest.mocked(delivery.record).mockResolvedValue({ delivered: [], retried: ["n1"], bounced: [], attempt: 2 })
        const plan = { notificationIds: ["n1"], groupId: "w1", message: { to: "p1", subject: "s", body: "b" } }
        const result = await service.settle({ manager: inner, plan, verdict: "transient", at: AT })
        expect(result).toEqual({ delivered: 0, retried: 1, bounced: 0 })
        expect(outbox.enqueue).toHaveBeenCalledWith(inner, {
            queue: "notify.dispatch",
            eventId: "notify-retry:w1:2",
            payload: { kind: "retry", groupId: "w1" },
            availableAt: new Date(AT.getTime() + 30_000),
        })
    })
})
