import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { AccountError, AccountErrorCode } from "@modules/domain/account"
import { RegisterCommand } from "../../application/register.command"
import { RegisterResolver } from "./register.resolver"

const input = { email: "a@example.com", password: "secret-pass" }

describe("RegisterResolver", () => {
    it("dispatches one register command and answers the new person", async () => {
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value: { personId: "p-1" } }) })
        await expect(new RegisterResolver(commandBus).register(input)).resolves.toEqual({ personId: "p-1" })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(expect.any(RegisterCommand))
    })

    it("turns the refusal of a taken email into the account error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: AccountErrorCode.EmailTaken }),
        })
        await expect(new RegisterResolver(commandBus).register(input)).rejects.toBeInstanceOf(AccountError)
    })
})
