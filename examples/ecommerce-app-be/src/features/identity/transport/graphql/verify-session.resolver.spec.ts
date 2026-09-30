import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { SessionError, SessionErrorCode } from "@modules/domain/session"
import { VerifySessionQuery } from "../../application/verify-session.query"
import { VerifySessionResolver } from "./verify-session.resolver"

describe("VerifySessionResolver", () => {
    it("dispatches one verify query and answers the person", async () => {
        const queryBus = mock<QueryBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value: { personId: "p-1" } }) })
        await expect(new VerifySessionResolver(queryBus).verifySession({ sessionToken: "tok" })).resolves.toEqual({ personId: "p-1" })
        expect(queryBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledWith(expect.any(VerifySessionQuery))
    })

    it("turns the refusal of a dead token into the session error", async () => {
        const queryBus = mock<QueryBus>({ execute: jest.fn().mockResolvedValue({ kind: "refused", code: SessionErrorCode.Invalid }) })
        await expect(new VerifySessionResolver(queryBus).verifySession({ sessionToken: "dead" })).rejects.toBeInstanceOf(SessionError)
    })
})
