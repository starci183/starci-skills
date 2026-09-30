import { mock } from "@starci/jest-preset/mock"
import { AccountErrorCode } from "@modules/domain/account"
import type { AccountService } from "@modules/domain/account"
import type { SessionService } from "@modules/domain/session"
import type { Logger } from "@modules/platform/logging"
import { SignInCommand } from "./sign-in.command"
import { SignInHandler } from "./sign-in.handler"

const command = new SignInCommand({ request: { email: "a@example.com", password: "secret-pass" } })

describe("SignInHandler", () => {
    it("starts a session for the person the credentials name", async () => {
        const accounts = mock<AccountService>({ verifyCredentials: jest.fn().mockResolvedValue({ kind: "ok", value: { personId: "p-1" } }) })
        const sessions = mock<SessionService>({ issue: jest.fn().mockResolvedValue({ sessionToken: "tok", personId: "p-1" }) })
        await expect(new SignInHandler(mock<Logger>(), accounts, sessions).execute(command)).resolves.toEqual({
            kind: "ok",
            value: { sessionToken: "tok", personId: "p-1" },
        })
        expect(accounts.verifyCredentials).toHaveBeenCalledWith({ email: "a@example.com", password: "secret-pass" })
        expect(sessions.issue).toHaveBeenCalledWith({ personId: "p-1" })
    })

    it("refuses without starting a session when the credentials are wrong", async () => {
        const accounts = mock<AccountService>({
            verifyCredentials: jest.fn().mockResolvedValue({ kind: "refused", code: AccountErrorCode.InvalidCredentials }),
        })
        const sessions = mock<SessionService>()
        await expect(new SignInHandler(mock<Logger>(), accounts, sessions).execute(command)).resolves.toMatchObject({
            kind: "refused",
            code: AccountErrorCode.InvalidCredentials,
        })
        expect(sessions.issue).not.toHaveBeenCalled()
    })
})
