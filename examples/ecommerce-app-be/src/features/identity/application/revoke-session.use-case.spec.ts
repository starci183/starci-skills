import {
    SessionService
} from "ecommerce-app-be/modules/domain/session"
import {
    RequestInvalidException
} from "ecommerce-app-be/modules/platform/errors"
import {
    RevokeSessionUseCase
} from "./revoke-session.use-case"

describe("RevokeSessionUseCase",
    () => {
        const sessions = {
            revoke: jest.fn()
        }
        const useCase = new RevokeSessionUseCase(sessions as unknown as SessionService)

        beforeEach(() => {
            jest.clearAllMocks()
        })

        it("revokes a presented token and confirms",
            async () => {
                await expect(useCase.execute("token-abc")).resolves.toEqual({
                    revoked: true
                })
                expect(sessions.revoke).toHaveBeenCalledWith("token-abc")
            })

        it("refuses a missing or untyped token before touching the store",
            async () => {
                await expect(useCase.execute(undefined)).rejects.toBeInstanceOf(RequestInvalidException)
                await expect(useCase.execute(42)).rejects.toBeInstanceOf(RequestInvalidException)
                expect(sessions.revoke).not.toHaveBeenCalled()
            })
    })
