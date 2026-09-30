import { NotifyDeliveryAttemptEntity } from "./entities/delivery-attempt.entity"
import { NotifyDigestWindowEntity } from "./entities/digest-window.entity"
import { NotifyNotificationEntity } from "./entities/notification.entity"
import { NotifyPreferenceEntity } from "./entities/preference.entity"
import { toDeliveryAttemptView, toDigestWindowView, toNotificationView, toPreferenceView } from "./notify.rows"

const AT = new Date("2026-09-30T10:00:00.000Z")

describe("notify rows", () => {
    it("maps a notification row to its view", () => {
        const row = Object.assign(new NotifyNotificationEntity(), {
            id: "n1",
            kind: "task-complete",
            recipientId: "p1",
            payload: { taskId: "t1" },
            digestGroupId: "w1",
            createdAt: AT,
        })
        expect(toNotificationView(row)).toEqual({
            id: "n1",
            kind: "task-complete",
            recipientId: "p1",
            payload: { taskId: "t1" },
            digestGroupId: "w1",
            createdAt: AT,
        })
    })

    it("maps a delivery attempt row to its view", () => {
        const history = [{ state: "queued" as const, at: AT.toISOString() }]
        const row = Object.assign(new NotifyDeliveryAttemptEntity(), {
            notificationId: "n1",
            state: "queued" as const,
            attempt: 0,
            failureClass: null,
            startedAt: null,
            endedAt: null,
            history,
        })
        expect(toDeliveryAttemptView(row)).toEqual({
            notificationId: "n1",
            state: "queued",
            attempt: 0,
            failureClass: null,
            startedAt: null,
            endedAt: null,
            history,
        })
    })

    it("maps a digest window row to its view", () => {
        const row = Object.assign(new NotifyDigestWindowEntity(), {
            id: "w1",
            personId: "p1",
            channel: "email",
            opensAt: AT,
            closesAt: AT,
            flushedAt: null,
        })
        expect(toDigestWindowView(row)).toEqual({
            id: "w1",
            personId: "p1",
            channel: "email",
            opensAt: AT,
            closesAt: AT,
            flushedAt: null,
        })
    })

    it("maps a preference row to its view", () => {
        const row = Object.assign(new NotifyPreferenceEntity(), {
            personId: "p1",
            channel: "email",
            unsubscribed: true,
            digestWindowMinutes: 5,
        })
        expect(toPreferenceView(row)).toEqual({
            personId: "p1",
            channel: "email",
            unsubscribed: true,
            digestWindowMinutes: 5,
        })
    })
})
