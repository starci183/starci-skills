import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { NotifyErrorCode } from "@modules/domain/notify"
import type { NotifyService } from "@modules/domain/notify"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { AdmitNotificationCommand } from "./admit-notification.command"
import { AdmitNotificationHandler } from "./admit-notification.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const request = {
    sourceEventId: "evt-1",
    kind: "task-complete",
    recipientId: "owner-1",
    channel: "email",
    payload: { taskId: "t1" },
}

const build = (outcome: unknown) => {
    const inner = mockEntityManager()
    const notify = mock<NotifyService>({ admit: jest.fn().mockResolvedValue(outcome) })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new AdmitNotificationHandler(mock<Logger>(), entityManager, new FakeClock(AT), notify), notify, inner }
}

describe("AdmitNotificationHandler", () => {
    it("admits the event inside the transaction, stamped with the clock, and answers the admission", async () => {
        const admitted = { kind: "ok", value: { notificationId: "n1", isNew: true, deliveryState: "queued" } }
        const { handler, notify, inner } = build(admitted)
        const result = await handler.execute(new AdmitNotificationCommand({ request }))
        expect(result).toEqual(admitted)
        expect(notify.admit).toHaveBeenCalledWith({ manager: inner, ...request, at: AT })
    })

    it("returns a refusal as it is", async () => {
        const refusal = { kind: "refused", code: NotifyErrorCode.ChannelRequired }
        const { handler } = build(refusal)
        const result = await handler.execute(new AdmitNotificationCommand({ request: { ...request, channel: " " } }))
        expect(result).toEqual(refusal)
    })
})
