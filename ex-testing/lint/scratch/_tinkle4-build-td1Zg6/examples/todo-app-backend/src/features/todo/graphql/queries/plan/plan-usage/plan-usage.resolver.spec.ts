import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    PlanUsageQuery 
} from "@modules/bussiness/plan/plan-usage.query"
import type {
    PlanUsageQueryResult 
} from "@modules/bussiness/plan/plan-usage.query"

import {
    SessionExpiredException 
} from "@modules/shared/exceptions/errors/session/session-expired"
import {
    SessionNotFoundException 
} from "@modules/shared/exceptions/errors/session/session-not-found"
import {
    SessionRecord 
} from "@modules/bussiness/session/types/session-record"
import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    PlanSubscriptionNotFoundException 
} from "@modules/shared/exceptions/errors/plan/plan-subscription-not-found"

import {
    GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    PlanUsageResolver 
} from "./plan-usage.resolver"
import {
    PlanUsageResponse 
} from "./graphql-types/response"

describe("PlanUsageResolver",
    () => {
        let moduleRef: TestingModule
        let resolver: PlanUsageResolver
        let queryBus: { execute: jest.Mock }
        let sessionService: { findActive: jest.Mock }

        const req = (authorization?: string): GraphqlRequestLike => ({
            headers: authorization === undefined ? {
            } : {
                authorization 
            },
        })

        beforeEach(async () => {
            queryBus = {
                execute: jest.fn() 
            }
            sessionService = {
                findActive: jest.fn(async (token: string) => {
                    if (token === "token-expired") throw new SessionExpiredException({
                    })
                    if (!token) throw new SessionNotFoundException({
                        reason: "missing-token" 
                    })
                    return new SessionRecord(token,
                        "person-1",
                        new Date(),
                        new Date(Date.now() + 60_000))
                }),
            }
            moduleRef = await Test.createTestingModule({
                providers: [
                    PlanUsageResolver,
                    {
                        provide: QueryBus, useValue: queryBus 
                    },
                    {
                        provide: SessionService, useValue: sessionService 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(PlanUsageResolver)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("maps the usage result onto a PlanUsageResponse",
            async () => {
                const result: PlanUsageQueryResult = {
                    plan: "free", cap: 25, activeCount: 3 
                }
                queryBus.execute.mockResolvedValue(result)

                const response = await resolver.planUsage(req("Bearer token-1"))

                expect(response).toEqual(new PlanUsageResponse("free",
                    25,
                    3))
                expect(response).toBeInstanceOf(PlanUsageResponse)
            })

        it("keeps a null cap null on the paid plan (\"no cap\")",
            async () => {
                queryBus.execute.mockResolvedValue({
                    plan: "paid", cap: null, activeCount: 42 
                })

                const response = await resolver.planUsage(req("Bearer token-1"))

                expect(response).toEqual(new PlanUsageResponse("paid",
                    null,
                    42))
            })

        it("dispatches a PlanUsageQuery whose ownerId is the session actor",
            async () => {
                queryBus.execute.mockResolvedValue({
                    plan: "free", cap: 25, activeCount: 0 
                })

                await resolver.planUsage(req("Bearer token-1"))

                expect(sessionService.findActive).toHaveBeenCalledWith("token-1")
                const query = queryBus.execute.mock.calls[0][0]
                expect(query).toBeInstanceOf(PlanUsageQuery)
                expect(query.params).toEqual({
                    ownerId: "person-1" 
                })
            })

        it("refuses a request with no Authorization header before any query runs",
            async () => {
                await expect(resolver.planUsage(req())).rejects.toThrow(SessionNotFoundException)

                expect(sessionService.findActive).toHaveBeenCalledWith("")
                expect(queryBus.execute).not.toHaveBeenCalled()
            })

        it("propagates SessionExpiredException unchanged",
            async () => {
                await expect(resolver.planUsage(req("Bearer token-expired"))).rejects.toThrow(SessionExpiredException)

                expect(queryBus.execute).not.toHaveBeenCalled()
            })

        it("propagates a domain error raised inside the query bus unchanged",
            async () => {
                const failure = new PlanSubscriptionNotFoundException()
                queryBus.execute.mockRejectedValue(failure)

                await expect(resolver.planUsage(req("Bearer token-1"))).rejects.toBe(failure)
            })
    })
