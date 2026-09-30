import { mock } from "@starci/jest-preset/mock"
import { AccountErrorCode } from "@modules/domain/account"
import type { AccountService } from "@modules/domain/account"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { RegisterCommand } from "./register.command"
import { RegisterHandler } from "./register.handler"

const command = new RegisterCommand({ request: { email: "a@example.com", password: "secret-pass" } })

describe("RegisterHandler", () => {
    it("registers through the manager of one transaction and answers the new person", async () => {
        const inner = mockEntityManager()
        const accounts = mock<AccountService>({
            register: jest.fn().mockResolvedValue({ kind: "ok", value: { personId: "p-1" } }),
        })
        const handler = new RegisterHandler(
            mock<Logger>(),
            mockEntityManager({ transaction: fakeTransaction(inner) }),
            accounts,
        )
        await expect(handler.execute(command)).resolves.toEqual({ kind: "ok", value: { personId: "p-1" } })
        expect(accounts.register).toHaveBeenCalledWith({
            manager: inner,
            email: "a@example.com",
            password: "secret-pass",
        })
    })

    it("passes the refusal of a taken email through", async () => {
        const accounts = mock<AccountService>({
            register: jest.fn().mockResolvedValue({ kind: "refused", code: AccountErrorCode.EmailTaken }),
        })
        const handler = new RegisterHandler(
            mock<Logger>(),
            mockEntityManager({ transaction: fakeTransaction(mockEntityManager()) }),
            accounts,
        )
        await expect(handler.execute(command)).resolves.toMatchObject({
            kind: "refused",
            code: AccountErrorCode.EmailTaken,
        })
    })
})
