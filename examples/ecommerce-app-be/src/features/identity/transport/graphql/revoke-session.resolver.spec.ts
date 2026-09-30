import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { SessionError, SessionErrorCode } from "@modules/domain/session"
import type { Principal } from "@modules/platform/cqrs"
import { RevokeSessionCommand } from "../../application/revoke-session.command"
import { RevokeSessionResolver } from "./revoke-session.resolver"

const principal: Principal = { id: "p-1", roles: ["member"] }

describe("RevokeSessionResolver", () => {
    it("dispatches one revoke command carrying the principal and confirms", async () => {
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value: { revoked: true } }) })
        await expect(new RevokeSessionResolver(commandBus).revokeSession(principal, { sessionToken: "tok" })).resolves.toEqual({
            revoked: true,
        })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new RevokeSessionCommand({ request: { sessionToken: "tok" }, principal }))
    })

    it("turns the refusal into the session error", async () => {
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ kind: "refused", code: SessionErrorCode.Invalid }) })
        await expect(new RevokeSessionResolver(commandBus).revokeSession(principal, { sessionToken: "x" })).rejects.toBeInstanceOf(
            SessionError,
        )
    })
})
