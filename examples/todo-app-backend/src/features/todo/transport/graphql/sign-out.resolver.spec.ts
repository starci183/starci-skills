import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { IdentityError, IdentityErrorCode } from "@modules/domain/identity"
import { SignOutCommand } from "../../application/sign-out.command"
import { SignOutResolver } from "./sign-out.resolver"

describe("SignOutResolver", () => {
    it("dispatches one sign-out command with the token from the input and reports the result", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "ok", value: { signedOut: true } }),
        })
        const result = await new SignOutResolver(commandBus).signOut({ sessionToken: "token-1" })
        expect(result).toEqual({ signedOut: true })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new SignOutCommand({ request: { sessionToken: "token-1" } }))
    })

    it("turns the refusal of a token that names no live session into the session error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: IdentityErrorCode.NotFound }),
        })
        const call = new SignOutResolver(commandBus).signOut({ sessionToken: "no-such-token" })
        await expect(call).rejects.toBeInstanceOf(IdentityError)
        await expect(call).rejects.toMatchObject({ code: IdentityErrorCode.NotFound })
    })
})
