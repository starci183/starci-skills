import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import type { NotifyService } from "@modules/domain/notify"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { DispatchNotificationGroupCommand } from "./dispatch-notification-group.command"
import { DispatchNotificationGroupHandler } from "./dispatch-notification-group.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const plan = { notificationIds: ["n1"], groupId: "w1", message: { to: "owner-1", subject: "s", body: "b" } }

const build = (parts: { plan?: typeof plan | null; verdict?: string } = {}) => {
    const events: Array<string> = []
    const inner = mockEntityManager()
    const notify = mock<NotifyService>({
        prepareDispatch: jest.fn().mockImplementation(() => {
            events.push("prepare")
            return Promise.resolve(parts.plan === undefined ? plan : parts.plan)
        }),
        transmit: jest.fn().mockImplementation(() => {
            events.push("transmit")
            return Promise.resolve(parts.verdict ?? "delivered")
        }),
        settle: jest.fn().mockImplementation(() => {
            events.push("settle")
            return Promise.resolve({ delivered: 1, retried: 0, bounced: 0 })
        }),
    })
    const transaction = fakeTransaction(inner)
    const entityManager = mockEntityManager({
        transaction: jest.fn().mockImplementation((...args: Array<unknown>) => {
            events.push("open")
            return transaction(...args)
        }),
    })
    const handler = new DispatchNotificationGroupHandler(mock<Logger>(), entityManager, new FakeClock(AT), notify)
    return { handler, notify, inner, events }
}

describe("DispatchNotificationGroupHandler", () => {
    it("prepares in one transaction, sends outside any transaction, then settles in a second one", async () => {
        const { handler, notify, inner, events } = build()
        const result = await handler.execute(
            new DispatchNotificationGroupCommand({ request: { kind: "flush", groupId: "w1" } }),
        )
        expect(result).toEqual({ delivered: 1, retried: 0, bounced: 0 })
        expect(events).toEqual(["open", "prepare", "transmit", "open", "settle"])
        expect(notify.prepareDispatch).toHaveBeenCalledWith({ manager: inner, kind: "flush", groupId: "w1", at: AT })
        expect(notify.transmit).toHaveBeenCalledWith(plan)
        expect(notify.settle).toHaveBeenCalledWith({ manager: inner, plan, verdict: "delivered", at: AT })
    })

    it("settles with the verdict of a failed send so the retry can be written", async () => {
        const { handler, notify, inner } = build({ verdict: "transient" })
        await handler.execute(new DispatchNotificationGroupCommand({ request: { kind: "retry", groupId: "w1" } }))
        expect(notify.settle).toHaveBeenCalledWith({ manager: inner, plan, verdict: "transient", at: AT })
    })

    it("sends and settles nothing when there is nothing to send", async () => {
        const { handler, notify } = build({ plan: null })
        const result = await handler.execute(
            new DispatchNotificationGroupCommand({ request: { kind: "flush", groupId: "w1" } }),
        )
        expect(result).toEqual({ delivered: 0, retried: 0, bounced: 0 })
        expect(notify.transmit).not.toHaveBeenCalled()
        expect(notify.settle).not.toHaveBeenCalled()
    })
})
