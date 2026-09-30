import {
    NOTIFY_ADMIT_QUEUE,
    NOTIFY_DISPATCH_QUEUE,
    toNotifyAdmitMessage,
    toNotifyDispatchMessage,
} from "./notify.mapper"

const AT = new Date("2026-09-30T10:00:00.000Z")

describe("notify queues and messages", () => {
    it("declares the admit queue with five deliveries and a five second backoff", () => {
        expect(NOTIFY_ADMIT_QUEUE).toMatchObject({ name: "notify.admit", attempts: 5, backoffMs: 5_000 })
    })

    it("writes an admit message that is due at the event instant and carries an ISO instant", () => {
        const message = toNotifyAdmitMessage({
            eventId: "evt-1",
            kind: "task-complete",
            recipientId: "p1",
            channel: "email",
            payload: { taskId: "t1" },
            at: AT,
        })
        expect(message).toEqual({
            queue: "notify.admit",
            eventId: "evt-1",
            payload: {
                kind: "task-complete",
                recipientId: "p1",
                channel: "email",
                payload: { taskId: "t1" },
                at: "2026-09-30T10:00:00.000Z",
            },
            availableAt: AT,
        })
    })

    it("reads an admit payload back and refuses one that lacks a field or carries a nested value", () => {
        const stored = {
            kind: "task-complete",
            recipientId: "p1",
            channel: "email",
            payload: { taskId: "t1", n: 2, ok: true, none: null },
            at: AT.toISOString(),
        }
        expect(NOTIFY_ADMIT_QUEUE.parse(stored)).toEqual(stored)
        expect(NOTIFY_ADMIT_QUEUE.parse({ ...stored, channel: undefined })).toBeNull()
        expect(NOTIFY_ADMIT_QUEUE.parse({ ...stored, payload: { nested: { a: 1 } } })).toBeNull()
        expect(NOTIFY_ADMIT_QUEUE.parse({ ...stored, at: "not a date" })).toBeNull()
        expect(NOTIFY_ADMIT_QUEUE.parse("nope")).toBeNull()
    })

    it("writes a dispatch message that is due at the given instant, keeping the event id it was given", () => {
        const dueAt = new Date("2026-09-30T10:10:00.000Z")
        expect(toNotifyDispatchMessage({ eventId: "notify-flush:w1", kind: "flush", groupId: "w1", dueAt })).toEqual({
            queue: "notify.dispatch",
            eventId: "notify-flush:w1",
            payload: { kind: "flush", groupId: "w1" },
            availableAt: dueAt,
        })
    })

    it("reads a dispatch payload back and refuses an unknown kind", () => {
        expect(NOTIFY_DISPATCH_QUEUE.parse({ kind: "retry", groupId: "w1" })).toEqual({ kind: "retry", groupId: "w1" })
        expect(NOTIFY_DISPATCH_QUEUE.parse({ kind: "other", groupId: "w1" })).toBeNull()
        expect(NOTIFY_DISPATCH_QUEUE.parse({ kind: "flush" })).toBeNull()
    })
})
