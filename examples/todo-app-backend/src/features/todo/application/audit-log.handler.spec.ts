import { mock } from "@starci/jest-preset/mock"
import { AuditErrorCode } from "@modules/domain/audit"
import type { AuditLogService } from "@modules/domain/audit"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { AuditLogHandler } from "./audit-log.handler"
import { AuditLogQuery } from "./audit-log.query"

type ResolvedAuditLine = Awaited<ReturnType<AuditLogService["readChain"]>>[number]

const AT = new Date("2026-09-30T10:00:00.000Z")
const member: Principal = { id: "p1", roles: ["member"] }
const admin: Principal = { id: "root", roles: ["member", "admin"] }
const own: ResolvedAuditLine = { at: AT, action: "task.created", target: "t1", actor: "p1", tombstoned: false }
const chain: ReadonlyArray<ResolvedAuditLine> = [own, { at: AT, action: "task.deleted", target: "t2", actor: null, tombstoned: true }]
const noFilter = { action: null, target: null }

/** What `build` wires: the handler and the doubles the specs assert on. */
interface Built {
    handler: AuditLogHandler
    log: AuditLogService
}

const build = (): Built => {
    const log = mock<AuditLogService>({
        findLinesForPerson: jest.fn().mockResolvedValue([own]),
        readChain: jest.fn().mockResolvedValue(chain),
    })
    return { handler: new AuditLogHandler(mock<Logger>(), log), log }
}

describe("AuditLogHandler", () => {
    it("reads exactly the own lines of a member, without actor or key id, and never the wider chain", async () => {
        const { handler, log } = build()
        const result = await handler.execute(new AuditLogQuery({ request: noFilter, principal: member }))
        expect(result).toEqual({ kind: "ok", value: { lines: [{ at: AT, action: "task.created", target: "t1" }] } })
        expect(log.findLinesForPerson).toHaveBeenCalledWith("p1")
        expect(log.readChain).not.toHaveBeenCalled()
    })

    it("ignores the filter of a member: it cannot escalate to the whole chain", async () => {
        const { handler, log } = build()
        await handler.execute(new AuditLogQuery({ request: { action: "task.deleted", target: null }, principal: member }))
        expect(log.readChain).not.toHaveBeenCalled()
        expect(log.findLinesForPerson).toHaveBeenCalledWith("p1")
    })

    it("lets an administrator read the whole chain oldest first, tombstoned lines included, narrowed by the filter", async () => {
        const { handler, log } = build()
        const result = await handler.execute(
            new AuditLogQuery({ request: { action: "task.deleted", target: "t2" }, principal: admin }),
        )
        expect(log.readChain).toHaveBeenCalledWith({ action: "task.deleted", target: "t2" })
        expect(log.findLinesForPerson).not.toHaveBeenCalled()
        expect(result).toEqual({
            kind: "ok",
            value: {
                lines: [
                    { at: AT, action: "task.created", target: "t1" },
                    { at: AT, action: "task.deleted", target: "t2" },
                ],
            },
        })
    })

    it("answers an empty list for a person without lines", async () => {
        const log = mock<AuditLogService>({ findLinesForPerson: jest.fn().mockResolvedValue([]) })
        const result = await new AuditLogHandler(mock<Logger>(), log).execute(
            new AuditLogQuery({ request: noFilter, principal: member }),
        )
        expect(result).toEqual({ kind: "ok", value: { lines: [] } })
    })

    it("refuses a caller without an identity before any line is touched", async () => {
        const { handler, log } = build()
        const result = await handler.execute(
            new AuditLogQuery({ request: noFilter, principal: { id: "", roles: ["admin"] } }),
        )
        expect(result).toMatchObject({ kind: "refused", code: AuditErrorCode.OperatorRoleNotAuthorized })
        expect(log.findLinesForPerson).not.toHaveBeenCalled()
        expect(log.readChain).not.toHaveBeenCalled()
    })
})
