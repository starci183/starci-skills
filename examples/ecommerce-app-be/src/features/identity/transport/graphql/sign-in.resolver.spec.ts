import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { AccountError, AccountErrorCode } from "@modules/domain/account"
import { SignInCommand } from "../../application/sign-in.command"
import { SignInResolver } from "./sign-in.resolver"

const input = { email: "a@example.com", password: "secret-pass" }

describe("SignInResolver", () => {
    it("dispatches one sign-in command and answers the session", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "ok", value: { sessionToken: "tok", personId: "p-1" } }),
        })
        await expect(new SignInResolver(commandBus).signIn(input)).resolves.toEqual({
            sessionToken: "tok",
            personId: "p-1",
        })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(expect.any(SignInCommand))
    })

    it("turns the refusal of wrong credentials into the account error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: AccountErrorCode.InvalidCredentials }),
        })
        await expect(new SignInResolver(commandBus).signIn(input)).rejects.toBeInstanceOf(AccountError)
    })
})
