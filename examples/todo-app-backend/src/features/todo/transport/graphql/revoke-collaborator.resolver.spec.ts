import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { ShareError, ShareErrorCode } from "@modules/domain/share"
import type { Principal } from "@modules/platform/cqrs"
import { RevokeCollaboratorCommand } from "../../application/revoke-collaborator.command"
import { RevokeCollaboratorResolver } from "./revoke-collaborator.resolver"

const principal: Principal = { id: "owner-1", roles: ["member"] }

describe("RevokeCollaboratorResolver", () => {
    it("dispatches one revoke command with the caller and answers the revoked invitation", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "ok", value: { invitationId: "i1", status: "revoked" } }),
        })
        const result = await new RevokeCollaboratorResolver(commandBus).revokeCollaborator(principal, { invitationId: "i1" })
        expect(result).toEqual({ invitationId: "i1", status: "revoked" })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(
            new RevokeCollaboratorCommand({ request: { invitationId: "i1" }, principal }),
        )
    })

    it("turns a forbidden refusal into the share error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: ShareErrorCode.Forbidden }),
        })
        const attempt = new RevokeCollaboratorResolver(commandBus).revokeCollaborator(principal, { invitationId: "i1" })
        await expect(attempt).rejects.toBeInstanceOf(ShareError)
        await expect(attempt).rejects.toMatchObject({ code: ShareErrorCode.Forbidden })
    })
})
