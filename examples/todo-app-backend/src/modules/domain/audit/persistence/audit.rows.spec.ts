import type { AuditErasureRequestEntity } from "./entities/audit-erasure-request.entity"
import { toErasureRequestView } from "./audit.rows"

const AT = new Date("2026-09-30T10:00:00.000Z")

describe("audit rows mapper", () => {
    it("copies an erasure request row and keeps the dropped person id null", () => {
        const row: AuditErasureRequestEntity = {
            requestId: "r1",
            personId: null,
            state: "complete",
            requestedAt: AT,
            verifiedAt: AT,
            refusedAt: null,
            executingAt: AT,
            completedAt: AT,
        }
        expect(toErasureRequestView(row)).toEqual(row)
    })
})
