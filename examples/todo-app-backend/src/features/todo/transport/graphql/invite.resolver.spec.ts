import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { ShareError, ShareErrorCode } from "@modules/domain/share"
import type { Principal } from "@modules/platform/cqrs"
import { InviteCommand } from "../../application/invite.command"
import { InviteResolver } from "./invite.resolver"

const principal: Principal = { id: "owner-1", roles: ["member"] }
const input = { taskId: "t1", email: "ann@example.com", role: "editor" }

describe("InviteResolver", () => {
    it("dispatches one invite command with the caller and answers the pending invitation", async () => {
        const created = { invitationId: "i1", taskId: "t1", email: "ann@example.com", role: "editor", status: "pending" }
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value: created }) })
        const result = await new InviteResolver(commandBus).invite(principal, input)
        expect(result).toEqual(created)
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new InviteCommand({ request: input, principal }))
    })

    it("turns a refusal into the share error carrying its code and params", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: ShareErrorCode.InvalidRole, params: { role: "boss" } }),
        })
        const attempt = new InviteResolver(commandBus).invite(principal, { ...input, role: "boss" })
        await expect(attempt).rejects.toBeInstanceOf(ShareError)
        await expect(attempt).rejects.toMatchObject({ code: ShareErrorCode.InvalidRole, params: { role: "boss" } })
    })
})
