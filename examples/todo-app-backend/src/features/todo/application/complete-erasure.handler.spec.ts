import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { AuditErrorCode } from "@modules/domain/audit"
import type { AuditErasureService, ErasureRequestView } from "@modules/domain/audit"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import type { Outbox } from "@modules/platform/outbox"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { CompleteErasureCommand } from "./complete-erasure.command"
import { CompleteErasureHandler } from "./complete-erasure.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "p1", roles: ["member"] }
const complete: ErasureRequestView = {
    requestId: "r1",
    personId: null,
    state: "complete",
    requestedAt: AT,
    verifiedAt: AT,
    refusedAt: null,
    executingAt: AT,
    completedAt: AT,
}

/** What `build` wires: the handler and the doubles the specs assert on. */
interface Built {
    handler: CompleteErasureHandler
    erasure: AuditErasureService
    outbox: Outbox
    inner: ReturnType<typeof mockEntityManager>
}

const build = (
    outcome: Awaited<ReturnType<AuditErasureService["execute"]>>,
): Built => {
    const inner = mockEntityManager()
    const erasure = mock<AuditErasureService>({ execute: jest.fn().mockResolvedValue(outcome) })
    const outbox = mock<Outbox>()
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new CompleteErasureHandler(mock<Logger>(), entityManager, new FakeClock(AT), outbox, erasure), erasure, outbox, inner }
}

describe("CompleteErasureHandler", () => {
    it("completes the request of the caller and queues the completed line under the system actor", async () => {
        const { handler, erasure, outbox, inner } = build({ kind: "ok", value: complete })
        const result = await handler.execute(new CompleteErasureCommand({ request: { requestId: "r1" }, principal }))
        expect(result).toEqual({ kind: "ok", value: { requestId: "r1", state: "complete" } })
        expect(erasure.execute).toHaveBeenCalledWith({ manager: inner, requestId: "r1", callerId: "p1", at: AT })
        expect(outbox.enqueue).toHaveBeenCalledWith(
            inner,
            expect.objectContaining({
                queue: "audit.append",
                payload: { actorId: "system", action: "audit.erasure.completed", target: "r1", at: "2026-09-30T10:00:00.000Z" },
            }),
        )
    })

    it("refuses a caller who is not the subject and queues nothing", async () => {
        const refusal = { kind: "refused", code: AuditErrorCode.ErasureRequestForbidden, params: { requestId: "r1" } } as const
        const { handler, outbox } = build(refusal)
        const result = await handler.execute(new CompleteErasureCommand({ request: { requestId: "r1" }, principal }))
        expect(result).toEqual(refusal)
        expect(outbox.enqueue).not.toHaveBeenCalled()
    })

    it("hands the not-found and invalid-state refusals back the same way", async () => {
        for (const code of [AuditErrorCode.ErasureRequestNotFound, AuditErrorCode.ErasureRequestInvalidState]) {
            const { handler, outbox } = build({ kind: "refused", code })
            const result = await handler.execute(new CompleteErasureCommand({ request: { requestId: "r1" }, principal }))
            expect(result).toMatchObject({ kind: "refused", code })
            expect(outbox.enqueue).not.toHaveBeenCalled()
        }
    })
})
