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
    UpgradePlanCommand 
} from "@modules/bussiness/plan/upgrade-plan.command"

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
    UpgradePlanResolver 
} from "./upgrade-plan.resolver"

describe("UpgradePlanResolver (fr.plan.upgrade)",
    () => {
        let moduleRef: TestingModule
        let resolver: UpgradePlanResolver
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
                    UpgradePlanResolver,
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
            resolver = moduleRef.get(UpgradePlanResolver)
        })

        afterEach(() => moduleRef.close())

        it("resolves the actor from the Bearer token and dispatches UpgradePlanCommand for that owner",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockResolvedValue({
                    subscriptionId: "sub-1",
                    paymentIntentId: "pi-1",
                    checkoutUrl: "https://my.sepay.vn/qr/sub-1",
                    status: "pending",
                })

                const result = await resolver.upgradePlan(req("tok-1"))

                expect(findActive).toHaveBeenCalledWith("tok-1")
                expect(execute).toHaveBeenCalledTimes(1)
                const command = execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(UpgradePlanCommand)
                expect(command.params).toEqual({
                    ownerId: "person-1" 
                })
                expect(result).toEqual({
                    subscriptionId: "sub-1",
                    paymentIntentId: "pi-1",
                    checkoutUrl: "https://my.sepay.vn/qr/sub-1",
                    status: "pending",
                })
            })

        it("refuses before dispatch when the Authorization header is absent",
            async () => {
                findActive.mockRejectedValue(new SessionNotFoundException({
                    reason: "missing-token" 
                }))

                await expect(resolver.upgradePlan(req())).rejects.toThrow(SessionNotFoundException)
                expect(findActive).toHaveBeenCalledWith("")
                expect(execute).not.toHaveBeenCalled()
            })

        it("refuses before dispatch when the session is expired",
            async () => {
                findActive.mockRejectedValue(new SessionExpiredException())

                await expect(resolver.upgradePlan(req("tok-stale"))).rejects.toThrow(SessionExpiredException)
                expect(execute).not.toHaveBeenCalled()
            })

        it("propagates a plan-domain refusal from the command bus untouched",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockRejectedValue(new PlanSubscriptionNotFoundException({
                    subscriptionId: "sub-1" 
                }))

                await expect(resolver.upgradePlan(req("tok-1"))).rejects.toThrow(PlanSubscriptionNotFoundException)
            })
    })
