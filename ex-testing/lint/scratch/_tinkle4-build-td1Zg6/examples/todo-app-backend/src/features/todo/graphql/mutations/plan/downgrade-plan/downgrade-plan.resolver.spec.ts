import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    SessionRecord 
} from "@modules/bussiness/session/types/session-record"
import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    DowngradePlanCommand 
} from "@modules/bussiness/plan/downgrade-plan.command"

import {
    PlanSubscriptionNotFoundException 
} from "@modules/shared/exceptions/errors/plan/plan-subscription-not-found"
import {
    SessionExpiredException 
} from "@modules/shared/exceptions/errors/session/session-expired"
import {
    SessionNotFoundException 
} from "@modules/shared/exceptions/errors/session/session-not-found"

import {
    GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    DowngradePlanResolver 
} from "./downgrade-plan.resolver"

describe("DowngradePlanResolver (fr.plan.downgrade)",
    () => {
        let moduleRef: TestingModule
        let resolver: DowngradePlanResolver
        let execute: jest.Mock
        let findActive: jest.Mock

        const req = (token?: string): GraphqlRequestLike => ({
            headers: token === undefined ? {
            } : {
                authorization: `Bearer ${token}` 
            },
        })
        const activeSession = (personId = "person-1") =>
            new SessionRecord("tok-1",
                personId,
                new Date(),
                new Date(Date.now() + 60_000))

        beforeEach(async () => {
            execute = jest.fn()
            findActive = jest.fn()
            moduleRef = await Test.createTestingModule({
                providers: [
                    DowngradePlanResolver,
                    {
                        provide: CommandBus, useValue: {
                            execute 
                        } 
                    },
                    {
                        provide: SessionService, useValue: {
                            findActive 
                        } 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(DowngradePlanResolver)
        })

        afterEach(() => moduleRef.close())

        it("resolves the actor and dispatches DowngradePlanCommand, returning the new plan state",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockResolvedValue({
                    subscriptionId: "sub-1", plan: "free", status: "active" 
                })

                const result = await resolver.downgradePlan(req("tok-1"))

                expect(findActive).toHaveBeenCalledWith("tok-1")
                expect(execute).toHaveBeenCalledTimes(1)
                const command = execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(DowngradePlanCommand)
                expect(command.params).toEqual({
                    ownerId: "person-1" 
                })
                expect(result).toEqual({
                    subscriptionId: "sub-1", plan: "free", status: "active" 
                })
            })

        it("refuses before dispatch when the session cannot be resolved",
            async () => {
                findActive.mockRejectedValue(new SessionNotFoundException({
                    reason: "missing-token" 
                }))

                await expect(resolver.downgradePlan(req())).rejects.toThrow(SessionNotFoundException)
                expect(execute).not.toHaveBeenCalled()
            })

        it("refuses before dispatch when the session is expired",
            async () => {
                findActive.mockRejectedValue(new SessionExpiredException())

                await expect(resolver.downgradePlan(req("tok-stale"))).rejects.toThrow(SessionExpiredException)
                expect(execute).not.toHaveBeenCalled()
            })

        it("propagates PlanSubscriptionNotFoundException when the owner has no subscription row",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockRejectedValue(new PlanSubscriptionNotFoundException())

                await expect(resolver.downgradePlan(req("tok-1"))).rejects.toThrow(PlanSubscriptionNotFoundException)
            })
    })
