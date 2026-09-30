import { AUDIT_APPEND_QUEUE, toAuditAppendMessage } from "./audit-append.policy"
import { AuditAction } from "./audit.contracts"

const AT = new Date("2026-09-30T10:00:00.000Z")

describe("audit append queue", () => {
    it("declares the audit.append queue with five attempts and a five second backoff base", () => {
        expect(AUDIT_APPEND_QUEUE.name).toBe("audit.append")
        expect(AUDIT_APPEND_QUEUE.attempts).toBe(5)
        expect(AUDIT_APPEND_QUEUE.backoffMs).toBe(5000)
    })

    it("builds an outbox message due at the instant of the action, carrying an ISO instant", () => {
        const message = toAuditAppendMessage({
            eventId: "e1",
            actorId: "p1",
            action: AuditAction.TaskCompleted,
            target: "t1",
            at: AT,
        })
        expect(message).toEqual({
            queue: "audit.append",
            eventId: "e1",
            payload: { actorId: "p1", action: "task.completed", target: "t1", at: "2026-09-30T10:00:00.000Z" },
            availableAt: AT,
        })
    })

    it("parses what it built back to the same payload", () => {
        const message = toAuditAppendMessage({ eventId: "e1", actorId: "p1", action: AuditAction.SignedIn, target: null, at: AT })
        expect(AUDIT_APPEND_QUEUE.parse(message.payload)).toEqual({
            actorId: "p1",
            action: "login.signed-in",
            target: null,
            at: "2026-09-30T10:00:00.000Z",
        })
    })

    it("refuses a payload of the wrong shape", () => {
        const good = { actorId: "p1", action: "task.created", target: null, at: "2026-09-30T10:00:00.000Z" }
        expect(AUDIT_APPEND_QUEUE.parse(good)).not.toBeNull()
        expect(AUDIT_APPEND_QUEUE.parse(null)).toBeNull()
        expect(AUDIT_APPEND_QUEUE.parse("x")).toBeNull()
        expect(AUDIT_APPEND_QUEUE.parse({ ...good, actorId: 1 })).toBeNull()
        expect(AUDIT_APPEND_QUEUE.parse({ ...good, action: "task.exploded" })).toBeNull()
        expect(AUDIT_APPEND_QUEUE.parse({ ...good, target: 5 })).toBeNull()
        expect(AUDIT_APPEND_QUEUE.parse({ ...good, at: "yesterday" })).toBeNull()
        expect(AUDIT_APPEND_QUEUE.parse({ ...good, at: 1 })).toBeNull()
    })
})
