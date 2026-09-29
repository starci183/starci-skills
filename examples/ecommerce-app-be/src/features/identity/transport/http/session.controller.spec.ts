import "reflect-metadata"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    SessionService 
} from "@modules/domain/session/index"
import {
    RevokeSessionUseCase 
} from "../../application/revoke-session.use-case"
import {
    VerifySessionUseCase 
} from "../../application/verify-session.use-case"
import {
    SessionController 
} from "./session.controller"

/**
 * The internal session surface the order service's identity client calls: verify answers only
 * the person behind a live session (or a typed 401 the consumer propagates), revoke forgets.
 */
describe("SessionController - sessions verify/revoke surface",
    () => {
        let controller: SessionController
        let sessions: ReturnType<typeof mock<SessionService>>

        beforeEach(async () => {
            sessions = mock<SessionService>()
            const module: TestingModule = await Test.createTestingModule({
                controllers: [SessionController],
                providers: [VerifySessionUseCase,
                    RevokeSessionUseCase,
                    {
                        provide: SessionService, useValue: sessions 
                    }],
            }).compile()
            controller = module.get(SessionController)
        })

        it("answers the person behind a live session token",
            async () => {
                sessions.verify.mockResolvedValue("person-1")
                await expect(controller.verify({
                    sessionToken: "token-abc" 
                })).resolves.toEqual({
                    personId: "person-1" 
                })
                expect(sessions.verify).toHaveBeenCalledWith("token-abc")
            })

        it("answers a dead or unknown token as a typed SESSION_INVALID refusal",
            async () => {
                sessions.verify.mockResolvedValue(null)
                await expect(controller.verify({
                    sessionToken: "token-gone" 
                })).rejects.toMatchObject({
                    name: "SessionInvalidException", code: "SESSION_INVALID_EXCEPTION", message: "No live session answers this token." 
                })
            })

        it.each([[{
        }],
        [{
            sessionToken: 42 
        }],
        [{
            sessionToken: "" 
        }]])(
            "a body without a usable token %j verifies as an empty token, never crashes",
            async (body) => {
                sessions.verify.mockResolvedValue(null)
                await expect(controller.verify(body)).rejects.toMatchObject({
                    code: "SESSION_INVALID_EXCEPTION" 
                })
                expect(sessions.verify).toHaveBeenCalledWith("")
            },
        )

        it("revokes a presented token and confirms",
            async () => {
                await expect(controller.revoke({
                    sessionToken: "token-abc" 
                })).resolves.toEqual({
                    revoked: true 
                })
                expect(sessions.revoke).toHaveBeenCalledWith("token-abc")
            })

        it.each([[{
        }],
        [{
            sessionToken: 42 
        }]])("refuses revoke without a token %j as REQUEST_INVALID before touching the store",
            async (body) => {
                await expect(controller.revoke(body)).rejects.toMatchObject({
                    code: "REQUEST_INVALID_EXCEPTION", message: "sessionToken is required." 
                })
                expect(sessions.revoke).not.toHaveBeenCalled()
            })
    })
