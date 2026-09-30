import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { AuditErrorCode } from "@modules/domain/audit"
import type { AuditErasureService, ErasureRequestView } from "@modules/domain/audit"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import type { Outbox } from "@modules/platform/outbox"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { RequestErasureCommand } from "./request-erasure.command"
import { RequestErasureHandler } from "./request-erasure.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "p1", roles: ["member"] }
const verified: ErasureRequestView = {
    requestId: "r1",
    personId: "p1",
    state: "verified",
    requestedAt: AT,
    verifiedAt: AT,
    refusedAt: null,
    executingAt: null,
    completedAt: null,
}

const build = (
    outcome: Awaited<ReturnType<AuditErasureService["request"]>>,
): { handler: RequestErasureHandler; erasure: AuditErasureService; outbox: Outbox; inner: ReturnType<typeof mockEntityManager> } => {
    const inner = mockEntityManager()
    const erasure = mock<AuditErasureService>({ request: jest.fn().mockResolvedValue(outcome) })
    const outbox = mock<Outbox>()
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new RequestErasureHandler(mock<Logger>(), entityManager, new FakeClock(AT), outbox, erasure), erasure, outbox, inner }
}

describe("RequestErasureHandler", () => {
    it("opens one verified request for the caller and queues the requested line under the system actor", async () => {
        const { handler, erasure, outbox, inner } = build({ kind: "ok", value: verified })
        const result = await handler.execute(new RequestErasureCommand({ request: {}, principal }))
        expect(result).toEqual({ kind: "ok", value: { requestId: "r1", state: "verified" } })
        expect(erasure.request).toHaveBeenCalledWith({ manager: inner, personId: "p1", at: AT })
        expect(outbox.enqueue).toHaveBeenCalledTimes(1)
        expect(outbox.enqueue).toHaveBeenCalledWith(
            inner,
            expect.objectContaining({
                queue: "audit.append",
                availableAt: AT,
                payload: { actorId: "system", action: "audit.erasure.requested", target: "r1", at: "2026-09-30T10:00:00.000Z" },
            }),
        )
    })

    it("never names the person on the queued line", async () => {
        const { handler, outbox } = build({ kind: "ok", value: verified })
        await handler.execute(new RequestErasureCommand({ request: {}, principal }))
        expect(JSON.stringify(jest.mocked(outbox.enqueue).mock.calls[0]?.[1])).not.toContain("p1")
    })

    it("hands a refusal back and queues nothing", async () => {
        const refusal = { kind: "refused", code: AuditErrorCode.ErasureRequestForbidden, params: { requestId: "r1" } } as const
        const { handler, outbox } = build(refusal)
        const result = await handler.execute(new RequestErasureCommand({ request: {}, principal }))
        expect(result).toEqual(refusal)
        expect(outbox.enqueue).not.toHaveBeenCalled()
    })
})
