import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { ShareError, ShareErrorCode } from "@modules/domain/share"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptInvitationCommand } from "../../application/accept-invitation.command"
import { AcceptInvitationResolver } from "./accept-invitation.resolver"

const principal: Principal = { id: "ann", roles: ["member"] }
const input = { invitationId: "i1", email: "ann@example.com" }

describe("AcceptInvitationResolver", () => {
    it("dispatches one accept command with the caller and answers the accepted invitation", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "ok", value: { invitationId: "i1", role: "editor", status: "accepted" } }),
        })
        const result = await new AcceptInvitationResolver(commandBus).acceptInvitation(principal, input)
        expect(result).toEqual({ invitationId: "i1", role: "editor", status: "accepted" })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new AcceptInvitationCommand({ request: input, principal }))
    })

    it("turns a refusal into the share error carrying its code", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: ShareErrorCode.EmailMismatch }),
        })
        const attempt = new AcceptInvitationResolver(commandBus).acceptInvitation(principal, input)
        await expect(attempt).rejects.toBeInstanceOf(ShareError)
        await expect(attempt).rejects.toMatchObject({ code: ShareErrorCode.EmailMismatch })
    })
})
