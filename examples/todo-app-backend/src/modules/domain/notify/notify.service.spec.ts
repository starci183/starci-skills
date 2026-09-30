import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager, recordingOutbox } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { OUTBOX } from "@modules/platform/outbox"
import { DedupeService } from "./dedupe.service"
import { DeliveryService } from "./delivery.service"
import { DigestService } from "./digest.service"
import { NotifyErrorCode } from "./errors/notify.error"
import {
    NOTIFY_AT,
    admitInput,
    deliveryAttemptView,
    dispatchPlan,
    notificationView,
    preferenceView,
    prepareDispatchInput,
    receiveAdmitInput,
    receiveDispatchInput,
    settleDispatchInput,
} from "@tests/fixtures/builders/notify.builder"
import { NotifyService } from "./notify.service"
import { PreferencesService } from "./preferences.service"

const NOW = NOTIFY_AT
const AT = new Date(NOW)
const CLOSES_AT = new Date("2026-09-30T10:10:00.000Z")
const RETRY_AT = new Date("2026-09-30T10:00:30.000Z")

const build = async () => {
    const clock = new FakeClock(NOW)
    const tx = fakeTransaction(mockEntityManager())
    const outbox = recordingOutbox()
    const inbox = mock<Inbox>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key} ${JSON.stringify(params)}`)
    const dedupe = mock<DedupeService>()
    const digest = mock<DigestService>()
    const preferences = mock<PreferencesService>()
    const delivery = mock<DeliveryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            NotifyService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: OUTBOX, useValue: outbox },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: clock },
            { provide: INBOX, useValue: inbox },
            { provide: DedupeService, useValue: dedupe },
            { provide: DigestService, useValue: digest },
            { provide: PreferencesService, useValue: preferences },
            { provide: DeliveryService, useValue: delivery },
        ],
    }).compile()
    return {
        service: moduleRef.get(NotifyService),
        tx,
        outbox,
        inbox,
        catalog,
        dedupe,
        digest,
        preferences,
        delivery,
    }
}

type Built = Awaited<ReturnType<typeof build>>

/** Stubs an admission of a brand new event of a subscribed person whose window is `opened` or joined. */
const stubNewAdmission = (built: Built, options: { opened: boolean; windowMinutes?: number | null }) => {
    built.dedupe.admit.mockResolvedValue({ notification: notificationView(), isNew: true })
    built.preferences.get.mockResolvedValue(preferenceView({ digestWindowMinutes: options.windowMinutes ?? null }))
    built.delivery.admit.mockResolvedValue(deliveryAttemptView())
    built.digest.admit.mockResolvedValue({ windowId: "w1", opened: options.opened, closesAt: CLOSES_AT })
    built.dedupe.assignDigestGroup.mockResolvedValue(undefined)
}

describe("NotifyService", () => {
    describe("admit", () => {
        it("refuses a blank channel before touching any table", async () => {
            const built = await build()

            await expect(built.service.admit({ manager: built.tx.em, ...admitInput({ channel: "  " }) })).resolves.toBeRefused(
                NotifyErrorCode.ChannelRequired,
            )

            expect(built.dedupe.admit).not.toHaveBeenCalled()
            expect(built.outbox.messages).toEqual([])
        })

        it("reads back the first decision of an event admitted before and writes nothing", async () => {
            const built = await build()
            built.dedupe.admit.mockResolvedValue({ notification: notificationView(), isNew: false })
            built.delivery.find.mockResolvedValue(deliveryAttemptView({ state: "delivered" }))

            await expect(built.service.admit({ manager: built.tx.em, ...admitInput() })).resolves.toSucceedWith({
                notificationId: "n1",
                isNew: false,
                deliveryState: "delivered",
            })

            expect(built.delivery.find).toHaveBeenCalledWith({ notificationId: "n1" })
            expect(built.preferences.get).not.toHaveBeenCalled()
            expect(built.delivery.admit).not.toHaveBeenCalled()
            expect(built.digest.admit).not.toHaveBeenCalled()
            expect(built.outbox.messages).toEqual([])
        })

        it("reads a repeated event without an attempt as queued", async () => {
            const built = await build()
            built.dedupe.admit.mockResolvedValue({ notification: notificationView(), isNew: false })
            built.delivery.find.mockResolvedValue(null)

            await expect(built.service.admit({ manager: built.tx.em, ...admitInput() })).resolves.toSucceedWith({
                notificationId: "n1",
                isNew: false,
                deliveryState: "queued",
            })
        })

        it("suppresses an unsubscribed recipient before any window, group or outbox message", async () => {
            const built = await build()
            built.dedupe.admit.mockResolvedValue({ notification: notificationView(), isNew: true })
            built.preferences.get.mockResolvedValue(preferenceView({ unsubscribed: true }))
            built.delivery.admit.mockResolvedValue(deliveryAttemptView({ state: "suppressed", failureClass: "unsubscribed" }))

            await expect(built.service.admit({ manager: built.tx.em, ...admitInput() })).resolves.toSucceedWith({
                notificationId: "n1",
                isNew: true,
                deliveryState: "suppressed",
            })

            expect(built.preferences.get).toHaveBeenCalledWith({ personId: "p1", channel: "email" })
            expect(built.delivery.admit).toHaveBeenCalledWith({
                manager: built.tx.em,
                notificationId: "n1",
                at: AT,
                unsubscribed: true,
            })
            expect(built.digest.admit).not.toHaveBeenCalled()
            expect(built.dedupe.assignDigestGroup).not.toHaveBeenCalled()
            expect(built.outbox.messages).toEqual([])
        })

        it("opens the default ten minute window, assigns the group and writes the one flush message", async () => {
            const built = await build()
            stubNewAdmission(built, { opened: true })

            await expect(built.service.admit({ manager: built.tx.em, ...admitInput() })).resolves.toSucceedWith({
                notificationId: "n1",
                isNew: true,
                deliveryState: "queued",
            })

            expect(built.digest.admit).toHaveBeenCalledWith({
                manager: built.tx.em,
                personId: "p1",
                channel: "email",
                at: AT,
                windowMinutes: 10,
            })
            expect(built.dedupe.assignDigestGroup).toHaveBeenCalledWith({
                manager: built.tx.em,
                id: "n1",
                digestGroupId: "w1",
            })
            expect(built.outbox.messages).toEqual([
                {
                    queue: "notify.dispatch",
                    eventId: "notify-flush:w1",
                    payload: { kind: "flush", groupId: "w1" },
                    availableAt: CLOSES_AT,
                },
            ])
        })

        it("opens the window the person's preference asks for", async () => {
            const built = await build()
            stubNewAdmission(built, { opened: true, windowMinutes: 30 })

            await built.service.admit({ manager: built.tx.em, ...admitInput() })

            expect(built.digest.admit).toHaveBeenCalledWith(expect.objectContaining({ windowMinutes: 30 }))
        })

        it("joins an open window without writing a second flush message", async () => {
            const built = await build()
            stubNewAdmission(built, { opened: false })

            await built.service.admit({ manager: built.tx.em, ...admitInput() })

            expect(built.dedupe.assignDigestGroup).toHaveBeenCalledTimes(1)
            expect(built.outbox.messages).toEqual([])
        })
    })

    describe("prepareDispatch", () => {
        it("prepares nothing when the window to flush is unknown, flushed or still open", async () => {
            const built = await build()
            built.digest.flush.mockResolvedValue(null)

            await expect(built.service.prepareDispatch({ manager: built.tx.em, ...prepareDispatchInput() })).resolves.toBeNull()

            expect(built.digest.flush).toHaveBeenCalledWith({ manager: built.tx.em, windowId: "w1", at: AT })
            expect(built.dedupe.findByDigestGroup).not.toHaveBeenCalled()
        })

        it("prepares nothing for a group without notifications", async () => {
            const built = await build()
            built.dedupe.findByDigestGroup.mockResolvedValue([])

            await expect(built.service.prepareDispatch({ manager: built.tx.em, ...prepareDispatchInput({ kind: "retry" }) })).resolves.toBeNull()

            expect(built.digest.flush).not.toHaveBeenCalled()
            expect(built.delivery.markSending).not.toHaveBeenCalled()
        })

        it("prepares nothing when no attempt of the group is queued any more", async () => {
            const built = await build()
            built.dedupe.findByDigestGroup.mockResolvedValue([notificationView()])
            built.delivery.markSending.mockResolvedValue([])

            await expect(built.service.prepareDispatch({ manager: built.tx.em, ...prepareDispatchInput({ kind: "retry" }) })).resolves.toBeNull()
        })

        it("marks the queued attempts sending and renders the task-complete email for one notification", async () => {
            const built = await build()
            built.digest.flush.mockResolvedValue({ windowId: "w1", personId: "p1", channel: "email" })
            built.dedupe.findByDigestGroup.mockResolvedValue([notificationView()])
            built.delivery.markSending.mockResolvedValue([deliveryAttemptView({ state: "sending" })])

            const plan = await built.service.prepareDispatch({ manager: built.tx.em, ...prepareDispatchInput() })

            expect(plan).toEqual({
                notificationIds: ["n1"],
                groupId: "w1",
                message: {
                    to: "p1",
                    subject: 'notify.email.task-complete.subject {"taskId":"t1"}',
                    body: 'notify.email.line {"kind":"task-complete","payload":"{\\"taskId\\":\\"t1\\"}"}',
                },
            })
            expect(built.dedupe.findByDigestGroup).toHaveBeenCalledWith({ groupId: "w1" })
            expect(built.delivery.markSending).toHaveBeenCalledWith({
                manager: built.tx.em,
                notificationIds: ["n1"],
                at: AT,
            })
            expect(built.catalog.get).toHaveBeenCalledWith("notify.email.line", expect.any(Object), "vi")
        })

        it("renders an empty task id when a task-complete payload carries none", async () => {
            const built = await build()
            built.dedupe.findByDigestGroup.mockResolvedValue([notificationView({ payload: {} })])
            built.delivery.markSending.mockResolvedValue([deliveryAttemptView({ state: "sending" })])

            const plan = await built.service.prepareDispatch({ manager: built.tx.em, ...prepareDispatchInput({ kind: "retry" }) })

            expect(plan?.message.subject).toBe('notify.email.task-complete.subject {"taskId":""}')
        })

        it("renders the generic subject for a kind that has no subject of its own", async () => {
            const built = await build()
            built.dedupe.findByDigestGroup.mockResolvedValue([notificationView({ kind: "task-reopened" })])
            built.delivery.markSending.mockResolvedValue([deliveryAttemptView({ state: "sending" })])

            const plan = await built.service.prepareDispatch({ manager: built.tx.em, ...prepareDispatchInput({ kind: "retry" }) })

            expect(plan?.message.subject).toBe('notify.email.generic.subject {"kind":"task-reopened"}')
        })

        it("renders one digest message with a line per notification for a group of several", async () => {
            const built = await build()
            built.dedupe.findByDigestGroup.mockResolvedValue([
                notificationView({ id: "n1" }),
                notificationView({ id: "n2", payload: { taskId: "t2" } }),
            ])
            built.delivery.markSending.mockResolvedValue([
                deliveryAttemptView({ notificationId: "n1", state: "sending" }),
                deliveryAttemptView({ notificationId: "n2", state: "sending" }),
            ])

            const plan = await built.service.prepareDispatch({ manager: built.tx.em, ...prepareDispatchInput({ kind: "retry" }) })

            expect(plan?.notificationIds).toEqual(["n1", "n2"])
            expect(plan?.message.to).toBe("p1")
            expect(plan?.message.subject).toBe('notify.email.digest.subject {"count":2}')
            expect(plan?.message.body.split("\n")).toHaveLength(2)
        })
    })

    describe("transmit", () => {
        it("sends the message of the plan and answers the verdict", async () => {
            const built = await build()
            const plan = dispatchPlan({ notificationIds: ["n1"] })
            built.delivery.transmit.mockResolvedValue("delivered")

            await expect(built.service.transmit(plan)).resolves.toBe("delivered")

            expect(built.delivery.transmit).toHaveBeenCalledWith(plan.message)
        })
    })

    describe("settle", () => {
        it("counts what the send came to and writes no message when nothing goes back to queued", async () => {
            const built = await build()
            built.delivery.record.mockResolvedValue({ delivered: ["n1"], retried: [], bounced: ["n2"], attempt: 1 })

            await expect(
                built.service.settle({ manager: built.tx.em, ...settleDispatchInput() }),
            ).resolves.toEqual({ delivered: 1, retried: 0, bounced: 1 })

            expect(built.delivery.record).toHaveBeenCalledWith({
                manager: built.tx.em,
                notificationIds: ["n1", "n2"],
                verdict: "delivered",
                at: AT,
            })
            expect(built.outbox.messages).toEqual([])
        })

        it("writes one retry message after the backoff when attempts go back to queued", async () => {
            const built = await build()
            built.delivery.record.mockResolvedValue({ delivered: [], retried: ["n1", "n2"], bounced: [], attempt: 2 })

            await expect(
                built.service.settle({ manager: built.tx.em, ...settleDispatchInput({ verdict: "transient" }) }),
            ).resolves.toEqual({ delivered: 0, retried: 2, bounced: 0 })

            expect(built.outbox.messages).toEqual([
                {
                    queue: "notify.dispatch",
                    eventId: "notify-retry:w1:2",
                    payload: { kind: "retry", groupId: "w1" },
                    availableAt: RETRY_AT,
                },
            ])
        })
    })

    describe("admitOnce", () => {
        it("does nothing for a message that was claimed before", async () => {
            const built = await build()
            built.inbox.claim.mockResolvedValue(false)

            await expect(built.service.admitOnce(receiveAdmitInput())).resolves.toSucceedWith(null)

            expect(built.inbox.claim).toHaveBeenCalledWith("notify.admit", "evt-1")
            expect(built.tx.outcomes).toEqual([])
            expect(built.inbox.release).not.toHaveBeenCalled()
        })

        it("admits the event in one committed transaction stamped with the clock and writes the flush in it", async () => {
            const built = await build()
            built.inbox.claim.mockResolvedValue(true)
            stubNewAdmission(built, { opened: true })

            await expect(built.service.admitOnce(receiveAdmitInput())).resolves.toSucceedWith({
                notificationId: "n1",
                isNew: true,
                deliveryState: "queued",
            })

            expect(built.tx.commits).toBe(1)
            expect(built.dedupe.admit).toHaveBeenCalledWith(
                expect.objectContaining({ kind: "task-complete", sourceEventId: "evt-1", recipientId: "p1", at: AT }),
            )
            expect(built.outbox.allInTransaction).toBe(true)
            expect(built.outbox.messages.map((message) => message.eventId)).toEqual(["notify-flush:w1"])
            expect(built.inbox.release).not.toHaveBeenCalled()
        })

        it("keeps the refusal of a blank channel and leaves the claim in place", async () => {
            const built = await build()
            built.inbox.claim.mockResolvedValue(true)

            await expect(built.service.admitOnce(receiveAdmitInput({ channel: "" }))).resolves.toBeRefused(
                NotifyErrorCode.ChannelRequired,
            )

            expect(built.inbox.release).not.toHaveBeenCalled()
        })

        it("gives the claim back and rethrows when the admission fails, so the redelivery runs", async () => {
            const built = await build()
            built.inbox.claim.mockResolvedValue(true)
            const failure = new TypeError("database is down")
            built.dedupe.admit.mockRejectedValue(failure)

            await expect(built.service.admitOnce(receiveAdmitInput())).rejects.toBe(failure)

            expect(built.tx.rollbacks).toBe(1)
            expect(built.inbox.release).toHaveBeenCalledWith("notify.admit", "evt-1")
        })
    })

    describe("dispatchOnce", () => {
        const stubPlan = (built: Built) => {
            built.digest.flush.mockResolvedValue({ windowId: "w1", personId: "p1", channel: "email" })
            built.dedupe.findByDigestGroup.mockResolvedValue([notificationView()])
            built.delivery.markSending.mockResolvedValue([deliveryAttemptView({ state: "sending" })])
        }

        it("sends nothing for a message that was claimed before", async () => {
            const built = await build()
            built.inbox.claim.mockResolvedValue(false)

            await expect(built.service.dispatchOnce(receiveDispatchInput())).resolves.toEqual({ delivered: 0, retried: 0, bounced: 0 })

            expect(built.inbox.claim).toHaveBeenCalledWith("notify.dispatch", "notify-flush:w1")
            expect(built.tx.outcomes).toEqual([])
        })

        it("answers zeros after the first transaction when there is nothing to send", async () => {
            const built = await build()
            built.inbox.claim.mockResolvedValue(true)
            built.digest.flush.mockResolvedValue(null)

            await expect(built.service.dispatchOnce(receiveDispatchInput())).resolves.toEqual({ delivered: 0, retried: 0, bounced: 0 })

            expect(built.tx.commits).toBe(1)
            expect(built.delivery.transmit).not.toHaveBeenCalled()
            expect(built.delivery.record).not.toHaveBeenCalled()
        })

        it("prepares in one transaction, sends outside any, and settles in a second", async () => {
            const built = await build()
            built.inbox.claim.mockResolvedValue(true)
            stubPlan(built)
            built.delivery.transmit.mockResolvedValue("transient")
            built.delivery.record.mockResolvedValue({ delivered: [], retried: ["n1"], bounced: [], attempt: 1 })

            await expect(built.service.dispatchOnce(receiveDispatchInput())).resolves.toEqual({ delivered: 0, retried: 1, bounced: 0 })

            expect(built.tx.commits).toBe(2)
            expect(built.delivery.transmit).toHaveBeenCalledTimes(1)
            expect(built.delivery.record).toHaveBeenCalledWith(
                expect.objectContaining({ notificationIds: ["n1"], verdict: "transient", at: AT }),
            )
            expect(built.outbox.allInTransaction).toBe(true)
            expect(built.outbox.messages.map((message) => message.eventId)).toEqual(["notify-retry:w1:1"])
            expect(built.inbox.release).not.toHaveBeenCalled()
        })

        it("gives the claim back and rethrows when the send step fails, so the redelivery runs", async () => {
            const built = await build()
            built.inbox.claim.mockResolvedValue(true)
            stubPlan(built)
            const failure = new TypeError("network is down")
            built.delivery.transmit.mockRejectedValue(failure)

            await expect(built.service.dispatchOnce(receiveDispatchInput())).rejects.toBe(failure)

            expect(built.delivery.record).not.toHaveBeenCalled()
            expect(built.inbox.release).toHaveBeenCalledWith("notify.dispatch", "notify-flush:w1")
        })
    })
})
