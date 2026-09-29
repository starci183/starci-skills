import {
    SessionService
} from "ecommerce-app-be/modules/domain/session"
import {
    SessionInvalidException
} from "ecommerce-app-be/modules/platform/errors"
import {
    VerifySessionUseCase
} from "./verify-session.use-case"

describe("VerifySessionUseCase",
    () => {
        const sessions = {
            verify: jest.fn()
        }
        const useCase = new VerifySessionUseCase(sessions as unknown as SessionService)

        beforeEach(() => {
            jest.clearAllMocks()
        })

        it("answers the person behind a live token",
            async () => {
                sessions.verify.mockResolvedValue("person-1")
                await expect(useCase.execute("token-abc")).resolves.toEqual({
                    personId: "person-1"
                })
                expect(sessions.verify).toHaveBeenCalledWith("token-abc")
            })

        it("refuses a token no live session answers as SESSION_INVALID",
            async () => {
                sessions.verify.mockResolvedValue(null)
                await expect(useCase.execute("token-gone")).rejects.toBeInstanceOf(SessionInvalidException)
            })

        it("verifies an untyped token as the empty token",
            async () => {
                sessions.verify.mockResolvedValue(null)
                await expect(useCase.execute(42)).rejects.toBeInstanceOf(SessionInvalidException)
                expect(sessions.verify).toHaveBeenCalledWith("")
            })
    })
