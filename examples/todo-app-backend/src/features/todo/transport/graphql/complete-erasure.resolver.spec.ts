import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { AuditError, AuditErrorCode } from "@modules/domain/audit"
import type { Principal } from "@modules/platform/cqrs"
import { CompleteErasureCommand } from "../../application/complete-erasure.command"
import { CompleteErasureResolver } from "./complete-erasure.resolver"

const principal: Principal = { id: "p1", roles: ["member"] }

describe("CompleteErasureResolver", () => {
    it("dispatches one complete command with the caller and answers the completed request", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "ok", value: { requestId: "r1", state: "complete" } }),
        })
        const result = await new CompleteErasureResolver(commandBus).completeErasure(principal, { requestId: "r1" })
        expect(result).toEqual({ requestId: "r1", state: "complete" })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new CompleteErasureCommand({ request: { requestId: "r1" }, principal }))
    })

    it("turns a refusal into the audit error carrying its code and params", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({
                kind: "refused",
                code: AuditErrorCode.ErasureRequestInvalidState,
                params: { state: "requested", expected: "verified" },
            }),
        })
        const attempt = new CompleteErasureResolver(commandBus).completeErasure(principal, { requestId: "r1" })
        await expect(attempt).rejects.toBeInstanceOf(AuditError)
        await expect(attempt).rejects.toMatchObject({
            code: AuditErrorCode.ErasureRequestInvalidState,
            params: { state: "requested", expected: "verified" },
        })
    })
})
