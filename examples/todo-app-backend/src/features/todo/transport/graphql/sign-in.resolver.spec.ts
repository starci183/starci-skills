import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { IdentityError, IdentityErrorCode } from "@modules/domain/identity"
import { SignInCommand } from "../../application/sign-in.command"
import { SignInResolver } from "./sign-in.resolver"

const input = { email: "person@example.com", password: "correct-horse" }

describe("SignInResolver", () => {
    it("dispatches one sign-in command with the credentials and answers the session token", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "ok", value: { sessionToken: "token-1", personId: "person-1" } }),
        })
        const result = await new SignInResolver(commandBus).signIn(input)
        expect(result).toEqual({ sessionToken: "token-1", personId: "person-1" })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new SignInCommand({ request: input }))
    })

    it("turns the refusal of the credentials into the session error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: IdentityErrorCode.InvalidCredentials }),
        })
        const call = new SignInResolver(commandBus).signIn(input)
        await expect(call).rejects.toBeInstanceOf(IdentityError)
        await expect(call).rejects.toMatchObject({ code: IdentityErrorCode.InvalidCredentials })
    })

    it("turns an outage of the identity provider into the session error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: IdentityErrorCode.ProviderUnavailable }),
        })
        await expect(new SignInResolver(commandBus).signIn(input)).rejects.toMatchObject({
            code: IdentityErrorCode.ProviderUnavailable,
        })
    })
})
