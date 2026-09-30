import { mock } from "@starci/jest-preset/mock"
import type { AuditLogService, ResolvedAuditLine } from "@modules/domain/audit"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { ExportMyDataHandler } from "./export-my-data.handler"
import { ExportMyDataQuery } from "./export-my-data.query"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "p1", roles: ["member", "admin"] }
const line: ResolvedAuditLine = { at: AT, action: "task.created", target: "t1", actor: "p1", tombstoned: false }

describe("ExportMyDataHandler", () => {
    it("exports only the lines of the caller, even for an administrator, without the actor", async () => {
        const log = mock<AuditLogService>({ findLinesForPerson: jest.fn().mockResolvedValue([line]) })
        const result = await new ExportMyDataHandler(mock<Logger>(), log).execute(new ExportMyDataQuery({ request: {}, principal }))
        expect(log.findLinesForPerson).toHaveBeenCalledWith("p1")
        expect(result).toEqual({ lines: [{ at: AT, action: "task.created", target: "t1" }] })
    })

    it("exports nothing once the key of the caller was destroyed by a completed erasure", async () => {
        const log = mock<AuditLogService>({ findLinesForPerson: jest.fn().mockResolvedValue([]) })
        const result = await new ExportMyDataHandler(mock<Logger>(), log).execute(new ExportMyDataQuery({ request: {}, principal }))
        expect(result).toEqual({ lines: [] })
    })
})
