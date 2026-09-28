import {
    Test 
} from "@nestjs/testing"
import {
    ExecutionContext, HttpException, HttpStatus 
} from "@nestjs/common"
import {
    Request 
} from "express"
import {
    IdentityApiClient 
} from "@modules/integrations/identity/identity.client"

import {
    ActorParams, SessionGuard 
} from "./session.guard"

describe("SessionGuard - order -> identity verify-session in front of every resolver",
    () => {
        const identityApi = {
            verifySession: jest.fn() 
        }
        let guard: SessionGuard

        beforeEach(async () => {
            jest.clearAllMocks()
            const moduleRef = await Test.createTestingModule({
                providers: [SessionGuard,
                    {
                        provide: IdentityApiClient, useValue: identityApi 
                    }],
            }).compile()
            guard = moduleRef.get(SessionGuard)
        })

        /** A GraphQL ExecutionContext the way Apollo hands it to a guard: the context object
         * carrying the HTTP request sits at argument index 2. */
        const contextFor = (headers: Record<string, unknown>) => {
            const request = {
                headers 
            } as unknown as Request & { actor?: ActorParams }
            class ProbeClass {}
            const handler = (): void => undefined
            const args: Array<unknown> = [{
            },
            {
            },
            {
                req: request 
            },
            {
            }]
            const context = {
                getType: () => "graphql",
                getArgs: () => args,
                getArgByIndex: (index: number) => args[index],
                getClass: () => ProbeClass,
                getHandler: () => handler,
                switchToHttp: () => ({
                    getRequest: () => request 
                }),
            } as unknown as ExecutionContext
            return {
                context, request 
            }
        }

        it("a verified bearer token admits the request carrying the person identity named",
            async () => {
                identityApi.verifySession.mockResolvedValue({
                    personId: "person-1" 
                })
                const { context, request } = contextFor({
                    authorization: "Bearer live-token" 
                })

                expect(await guard.canActivate(context)).toBe(true)
                expect(identityApi.verifySession).toHaveBeenCalledWith("live-token")
                expect(request.actor).toEqual({
                    personId: "person-1" 
                })
            })

        it.each([
            [{
            }],
            [{
                authorization: "Basic dTpw" 
            }],
            [{
                authorization: "Bearer " 
            }],
            [{
                authorization: "Bearer    " 
            }],
        ])("a request with %j is this service's own 401 without calling identity",
            async (headers) => {
                const { context } = contextFor(headers)
                try {
                    await guard.canActivate(context)
                    throw new Error("the call should have failed")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(HttpStatus.UNAUTHORIZED)
                    expect((error as HttpException).getResponse()).toMatchObject({
                        code: "SESSION_INVALID_EXCEPTION" 
                    })
                }
                expect(identityApi.verifySession).not.toHaveBeenCalled()
            })

        it("a token identity refuses is this service's own 401, never an invented actor",
            async () => {
                identityApi.verifySession.mockResolvedValue(null)
                const { context, request } = contextFor({
                    authorization: "Bearer stale-token" 
                })
                await expect(guard.canActivate(context)).rejects.toMatchObject({
                    status: HttpStatus.UNAUTHORIZED,
                    response: expect.objectContaining({
                        code: "SESSION_INVALID_EXCEPTION" 
                    }),
                })
                expect(request.actor).toBeUndefined()
            })

        it("an unreachable identity stays the typed 503 the client raised",
            async () => {
                identityApi.verifySession.mockRejectedValue(
                    new HttpException({
                        code: "IDENTITY_SERVICE_UNAVAILABLE_EXCEPTION" 
                    },
                    HttpStatus.SERVICE_UNAVAILABLE),
                )
                const { context } = contextFor({
                    authorization: "Bearer live-token" 
                })
                await expect(guard.canActivate(context)).rejects.toMatchObject({
                    status: HttpStatus.SERVICE_UNAVAILABLE,
                    response: expect.objectContaining({
                        code: "IDENTITY_SERVICE_UNAVAILABLE_EXCEPTION" 
                    }),
                })
            })
    })
