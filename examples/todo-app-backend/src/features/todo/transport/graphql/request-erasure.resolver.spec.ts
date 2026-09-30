import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { AuditError, AuditErrorCode } from "@modules/domain/audit"
import type { Principal } from "@modules/platform/cqrs"
import { RequestErasureCommand } from "../../application/request-erasure.command"
import { RequestErasureResolver } from "./request-erasure.resolver"

const principal: Principal = { id: "p1", roles: ["member"] }

describe("RequestErasureResolver", () => {
    it("dispatches one request command for the caller and answers the opened request", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "ok", value: { requestId: "r1", state: "verified" } }),
        })
        const result = await new RequestErasureResolver(commandBus).requestErasure(principal)
        expect(result).toEqual({ requestId: "r1", state: "verified" })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new RequestErasureCommand({ request: {}, principal }))
    })

    it("turns a refusal into the audit error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: AuditErrorCode.ErasureRequestForbidden }),
        })
        await expect(new RequestErasureResolver(commandBus).requestErasure(principal)).rejects.toBeInstanceOf(AuditError)
    })
})
