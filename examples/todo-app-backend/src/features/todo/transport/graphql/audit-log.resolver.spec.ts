import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { AuditError, AuditErrorCode } from "@modules/domain/audit"
import type { Principal } from "@modules/platform/cqrs"
import { AuditLogQuery } from "../../application/audit-log.query"
import { AuditLogResolver } from "./audit-log.resolver"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "p1", roles: ["member"] }

describe("AuditLogResolver", () => {
    it("dispatches one audit query carrying the principal and the filter, and answers the lines", async () => {
        const queryBus = mock<QueryBus>({
            execute: jest.fn().mockResolvedValue({ kind: "ok", value: { lines: [{ at: AT, action: "task.created", target: "t1" }] } }),
        })
        const result = await new AuditLogResolver(queryBus).auditLog(principal, { action: "task.created" })
        expect(result).toEqual([{ at: AT, action: "task.created", target: "t1" }])
        expect(queryBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledWith(
            new AuditLogQuery({ request: { action: "task.created", target: null }, principal }),
        )
    })

    it("turns a refusal into the audit error", async () => {
        const queryBus = mock<QueryBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: AuditErrorCode.OperatorRoleNotAuthorized }),
        })
        await expect(new AuditLogResolver(queryBus).auditLog(principal, {})).rejects.toBeInstanceOf(AuditError)
    })
})
