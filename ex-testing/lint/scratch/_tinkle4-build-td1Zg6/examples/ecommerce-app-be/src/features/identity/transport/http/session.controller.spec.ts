import "reflect-metadata"
import {
    HttpException 
} from "@nestjs/common"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    SessionService 
} from "@modules/bussiness/session/session.service"
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
        let sessions: { verify: jest.Mock; revoke: jest.Mock }

        beforeEach(async () => {
            sessions = {
                verify: jest.fn(), revoke: jest.fn() 
            }
            const module: TestingModule = await Test.createTestingModule({
                controllers: [SessionController],
                providers: [{
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

        it("answers a dead or unknown token as a typed 401 SESSION_INVALID",
            async () => {
                sessions.verify.mockResolvedValue(null)
                try {
                    await controller.verify({
                        sessionToken: "token-gone" 
                    })
                    throw new Error("the request should have been refused")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(401)
                    expect((error as HttpException).getResponse()).toEqual({
                        code: "SESSION_INVALID_EXCEPTION", message: "No live session answers this token." 
                    })
                }
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
                try {
                    await controller.verify(body)
                    throw new Error("the request should have been refused")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(401)
                }
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
        }]])("refuses revoke without a token %j as 400 before touching the store",
            async (body) => {
                try {
                    await controller.revoke(body)
                    throw new Error("the request should have been refused")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(400)
                    expect((error as HttpException).getResponse()).toEqual({
                        code: "REQUEST_INVALID_EXCEPTION", message: "sessionToken is required." 
                    })
                }
                expect(sessions.revoke).not.toHaveBeenCalled()
            })
    })
