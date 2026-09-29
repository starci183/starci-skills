import {
    ExecutionContext 
} from "@nestjs/common"
import {
    Test 
} from "@nestjs/testing"
import {
    Request 
} from "express"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    IdentityApiClient 
} from "@modules/integrations/identity/index"
import {
    IdentityServiceUnavailableException, SessionInvalidException 
} from "@modules/platform/errors/index"
import {
    ActorParams, SessionGuard 
} from "./session.guard"

describe("SessionGuard - order -> identity verify-session in front of every resolver",
    () => {
        const identityApi = mock<IdentityApiClient>()
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
            const request = mock<Request & { actor?: ActorParams }>({
                headers: headers as Request["headers"] 
            })
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
            const context = mock<ExecutionContext>({
                getType: jest.fn().mockReturnValue("graphql"),
                getArgs: jest.fn().mockReturnValue(args),
                getArgByIndex: jest.fn().mockImplementation((index: number) => args[index]),
                getClass: jest.fn().mockReturnValue(ProbeClass),
                getHandler: jest.fn().mockReturnValue(handler),
            })
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

        it.each([[{
        }],
        [{
            authorization: "Basic dTpw" 
        }],
        [{
            authorization: "Bearer " 
        }],
        [{
            authorization: "Bearer    " 
        }]])(
            "a request with %j is this service's own SESSION_INVALID without calling identity",
            async (headers) => {
                const { context } = contextFor(headers)

                await expect(guard.canActivate(context)).rejects.toMatchObject({
                    name: "SessionInvalidException",
                    code: "SESSION_INVALID_EXCEPTION",
                    message: "A Bearer session token is required.",
                })
                expect(identityApi.verifySession).not.toHaveBeenCalled()
            },
        )

        it("a token identity refuses is this service's own SESSION_INVALID, never an invented actor",
            async () => {
                identityApi.verifySession.mockResolvedValue(null)
                const { context, request } = contextFor({
                    authorization: "Bearer stale-token" 
                })

                await expect(guard.canActivate(context)).rejects.toBeInstanceOf(SessionInvalidException)
                expect(request.actor).toBeUndefined()
            })

        it("an unreachable identity stays the typed unavailable error the client raised",
            async () => {
                identityApi.verifySession.mockRejectedValue(new IdentityServiceUnavailableException({
                    message: "The identity service could not be reached." 
                }))
                const { context } = contextFor({
                    authorization: "Bearer live-token" 
                })

                await expect(guard.canActivate(context)).rejects.toMatchObject({
                    code: "IDENTITY_SERVICE_UNAVAILABLE_EXCEPTION" 
                })
            })

        it("a GraphQL context that carries no HTTP request is refused with the no-request sentence",
            async () => {
                const args: Array<unknown> = [{
                },
                {
                },
                {
                },
                {
                }]
                const context = mock<ExecutionContext>({
                    getType: jest.fn().mockReturnValue("graphql"),
                    getArgs: jest.fn().mockReturnValue(args),
                    getArgByIndex: jest.fn().mockImplementation((index: number) => args[index]),
                })

                await expect(guard.canActivate(context)).rejects.toMatchObject({
                    code: "SESSION_INVALID_EXCEPTION", message: "GraphQL context carries no HTTP request." 
                })
            })
    })
