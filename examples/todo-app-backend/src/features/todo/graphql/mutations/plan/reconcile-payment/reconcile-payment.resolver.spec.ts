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
    ReconcilePaymentCommand 
} from "@modules/bussiness/plan/reconcile-payment.command"

import {
    PlanForbiddenException 
} from "@modules/shared/exceptions/errors/plan/plan-forbidden"
import {
    PlanPaymentIntentNotFoundException 
} from "@modules/shared/exceptions/errors/plan/plan-payment-intent-not-found"
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
    ReconcilePaymentInput 
} from "./graphql-types/input"
import {
    ReconcilePaymentResolver 
} from "./reconcile-payment.resolver"

describe("ReconcilePaymentResolver (fr.plan.reconcile)",
    () => {
        let moduleRef: TestingModule
        let resolver: ReconcilePaymentResolver
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
        const input = (paymentIntentId: string): ReconcilePaymentInput =>
            Object.assign(new ReconcilePaymentInput(),
                {
                    paymentIntentId 
                })

        beforeEach(async () => {
            execute = jest.fn()
            findActive = jest.fn()
            moduleRef = await Test.createTestingModule({
                providers: [
                    ReconcilePaymentResolver,
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
            resolver = moduleRef.get(ReconcilePaymentResolver)
        })

        afterEach(() => moduleRef.close())

        it("dispatches ReconcilePaymentCommand with the caller as actor and the input intent id",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockResolvedValue({
                    gatewayStatus: "paid", applied: true, subscriptionStatus: "active" 
                })

                const result = await resolver.reconcilePayment(req("tok-1"),
                    input("pi-1"))

                expect(findActive).toHaveBeenCalledWith("tok-1")
                expect(execute).toHaveBeenCalledTimes(1)
                const command = execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(ReconcilePaymentCommand)
                expect(command.params).toEqual({
                    actorId: "person-1", paymentIntentId: "pi-1" 
                })
                expect(result).toEqual({
                    gatewayStatus: "paid", applied: true, subscriptionStatus: "active" 
                })
            })

        it("returns the no-op outcome when the intent was already applied or is still pending",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockResolvedValue({
                    gatewayStatus: "pending", applied: false, subscriptionStatus: "pending" 
                })

                const result = await resolver.reconcilePayment(req("tok-1"),
                    input("pi-1"))

                expect(result.applied).toBe(false)
                expect(result.gatewayStatus).toBe("pending")
            })

        it("propagates PlanPaymentIntentNotFoundException for an intent id this product never created",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockRejectedValue(new PlanPaymentIntentNotFoundException({
                    intentId: "pi-forged" 
                }))

                await expect(resolver.reconcilePayment(req("tok-1"),
                    input("pi-forged"))).rejects.toThrow(
                    PlanPaymentIntentNotFoundException,
                )
            })

        it("propagates PlanForbiddenException when the intent belongs to somebody else",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockRejectedValue(new PlanForbiddenException({
                    subscriptionId: "sub-2", actorId: "person-1" 
                }))

                await expect(resolver.reconcilePayment(req("tok-1"),
                    input("pi-other"))).rejects.toThrow(PlanForbiddenException)
            })

        it("refuses before dispatch when the session is missing or expired",
            async () => {
                findActive.mockRejectedValueOnce(new SessionNotFoundException({
                    reason: "missing-token" 
                }))
                await expect(resolver.reconcilePayment(req(),
                    input("pi-1"))).rejects.toThrow(SessionNotFoundException)

                findActive.mockRejectedValueOnce(new SessionExpiredException())
                await expect(resolver.reconcilePayment(req("tok-stale"),
                    input("pi-1"))).rejects.toThrow(SessionExpiredException)

                expect(execute).not.toHaveBeenCalled()
            })
    })
