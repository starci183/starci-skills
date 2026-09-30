import { toAuditLogRequest, toAuditLogType } from "./audit-log.mapper"

const AT = new Date("2026-09-30T10:00:00.000Z")

describe("audit-log mapper", () => {
    it("maps absent arguments to a null filter and given ones through", () => {
        expect(toAuditLogRequest({})).toEqual({ action: null, target: null })
        expect(toAuditLogRequest({ action: "task.created", target: "t1" })).toEqual({ action: "task.created", target: "t1" })
    })

    it("maps every line to a type without inventing fields", () => {
        expect(toAuditLogType({ lines: [{ at: AT, action: "task.created", target: null }] })).toEqual([
            { at: AT, action: "task.created", target: null },
        ])
    })
})
