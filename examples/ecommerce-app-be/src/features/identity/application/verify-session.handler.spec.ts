import { mock } from "@starci/jest-preset/mock"
import { SessionErrorCode } from "@modules/domain/session"
import type { SessionService } from "@modules/domain/session"
import type { Logger } from "@modules/platform/logging"
import { VerifySessionHandler } from "./verify-session.handler"
import { VerifySessionQuery } from "./verify-session.query"

const query = new VerifySessionQuery({ request: { sessionToken: "tok" } })

describe("VerifySessionHandler", () => {
    it("names the person behind a live token", async () => {
        const sessions = mock<SessionService>({ verify: jest.fn().mockResolvedValue({ personId: "p-1" }) })
        await expect(new VerifySessionHandler(mock<Logger>(), sessions).execute(query)).resolves.toEqual({
            kind: "ok",
            value: { personId: "p-1" },
        })
        expect(sessions.verify).toHaveBeenCalledWith("tok")
    })

    it("refuses a token no session answers", async () => {
        const sessions = mock<SessionService>({ verify: jest.fn().mockResolvedValue(null) })
        await expect(new VerifySessionHandler(mock<Logger>(), sessions).execute(query)).resolves.toMatchObject({
            kind: "refused",
            code: SessionErrorCode.Invalid,
        })
    })
})
