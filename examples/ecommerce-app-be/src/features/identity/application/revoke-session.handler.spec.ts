import { mock } from "@starci/jest-preset/mock"
import { SessionErrorCode } from "@modules/domain/session"
import type { SessionService } from "@modules/domain/session"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { RevokeSessionCommand } from "./revoke-session.command"
import { RevokeSessionHandler } from "./revoke-session.handler"

const principal: Principal = { id: "p-1", roles: ["member"] }
const command = new RevokeSessionCommand({ request: { sessionToken: "tok" }, principal })

describe("RevokeSessionHandler", () => {
    it("ends the session of the caller", async () => {
        const sessions = mock<SessionService>({
            verify: jest.fn().mockResolvedValue({ personId: "p-1" }),
            revoke: jest.fn().mockResolvedValue(undefined),
        })
        await expect(new RevokeSessionHandler(mock<Logger>(), sessions).execute(command)).resolves.toEqual({
            kind: "ok",
            value: { revoked: true },
        })
        expect(sessions.revoke).toHaveBeenCalledWith("tok")
    })

    it("refuses a session of another person and revokes nothing", async () => {
        const sessions = mock<SessionService>({ verify: jest.fn().mockResolvedValue({ personId: "p-2" }) })
        await expect(new RevokeSessionHandler(mock<Logger>(), sessions).execute(command)).resolves.toMatchObject({
            kind: "refused",
            code: SessionErrorCode.Invalid,
        })
        expect(sessions.revoke).not.toHaveBeenCalled()
    })

    it("refuses a token no session answers", async () => {
        const sessions = mock<SessionService>({ verify: jest.fn().mockResolvedValue(null) })
        await expect(new RevokeSessionHandler(mock<Logger>(), sessions).execute(command)).resolves.toMatchObject({ kind: "refused" })
    })
})
