import { Test } from "@nestjs/testing"
import { fakeIds, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { paymentIntentRow, PLAN_AT, PLAN_PERIOD_END } from "@tests/fixtures/builders/plan.builder"
import { PlanErrorCode } from "./errors/plan.error"
import { PaymentService } from "./payment.service"
import { PaymentIntentEntity } from "./persistence/entities/payment-intent.entity"

const LOCK = { where: { id: "i1" }, lock: { mode: "pessimistic_write" } }

const build = async (own: MockEntityManager = mockEntityManager()) => {
    const ids = fakeIds()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: own },
            { provide: IDS, useValue: ids },
        ],
    }).compile()
    return { service: moduleRef.get(PaymentService), own }
}

describe("PaymentService", () => {
    describe("create", () => {
        it("records a pending intent with no appliedAt through the manager it was handed", async () => {
            const { service, own } = await build()
            const manager = mockEntityManager({ save: [PaymentIntentEntity, paymentIntentRow()] })

            await expect(
                service.create({
                    manager,
                    subscriptionId: "s1",
                    gatewayIntentId: "g1",
                    amount: 99000,
                    currency: "VND",
                }),
            ).resolves.toEqual(paymentIntentRow())

            expect(manager.save).toHaveBeenCalledWith(PaymentIntentEntity, {
                id: "00000000-0000-4000-8000-000000000001",
                subscriptionId: "s1",
                gateway: "sepay",
                gatewayIntentId: "g1",
                amount: 99000,
                currency: "VND",
                status: "pending",
                appliedAt: null,
            })
            expect(own.save).not.toHaveBeenCalled()
        })
    })

    describe("findById", () => {
        it("reads through its own manager for a plain read", async () => {
            const { service, own } = await build(
                mockEntityManager({ findOneBy: [PaymentIntentEntity, paymentIntentRow()] }),
            )

            await expect(service.findById({ id: "i1" })).resolves.toEqual(paymentIntentRow())

            expect(own.findOneBy).toHaveBeenCalledWith(PaymentIntentEntity, { id: "i1" })
        })

        it("reads through the manager it was handed and not through its own", async () => {
            const { service, own } = await build()
            const manager = mockEntityManager({ findOneBy: [PaymentIntentEntity, paymentIntentRow()] })

            await expect(service.findById({ id: "i1", manager })).resolves.toEqual(paymentIntentRow())

            expect(manager.findOneBy).toHaveBeenCalledWith(PaymentIntentEntity, { id: "i1" })
            expect(own.findOneBy).not.toHaveBeenCalled()
        })

        it("answers null for an unknown id", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [PaymentIntentEntity, null] }))

            await expect(service.findById({ id: "nope" })).resolves.toBeNull()
        })
    })

    describe("findByGatewayIntentId", () => {
        it("finds the intent the gateway names by its own id", async () => {
            const { service, own } = await build(
                mockEntityManager({ findOneBy: [PaymentIntentEntity, paymentIntentRow()] }),
            )

            await expect(service.findByGatewayIntentId({ gatewayIntentId: "g1" })).resolves.toEqual(paymentIntentRow())

            expect(own.findOneBy).toHaveBeenCalledWith(PaymentIntentEntity, { gatewayIntentId: "g1" })
        })

        it("reads through the manager it was handed", async () => {
            const { service, own } = await build()
            const manager = mockEntityManager({ findOneBy: [PaymentIntentEntity, paymentIntentRow()] })

            await expect(service.findByGatewayIntentId({ gatewayIntentId: "g1", manager })).resolves.toEqual(
                paymentIntentRow(),
            )

            expect(own.findOneBy).not.toHaveBeenCalled()
        })

        it("answers null for an unknown gateway id", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [PaymentIntentEntity, null] }))

            await expect(service.findByGatewayIntentId({ gatewayIntentId: "nope" })).resolves.toBeNull()
        })
    })

    describe("markPaidIfNotApplied", () => {
        it("applies an unapplied intent once, under a row lock", async () => {
            const { service } = await build()
            const manager = mockEntityManager({
                findOne: [PaymentIntentEntity, paymentIntentRow()],
                save: [PaymentIntentEntity, paymentIntentRow({ status: "paid", appliedAt: PLAN_AT })],
            })

            await expect(service.markPaidIfNotApplied({ manager, id: "i1", at: PLAN_AT })).resolves.toSucceedWith({
                intent: paymentIntentRow({ status: "paid", appliedAt: PLAN_AT }),
                alreadyApplied: false,
            })

            expect(manager.findOne).toHaveBeenCalledWith(PaymentIntentEntity, LOCK)
            expect(manager.save).toHaveBeenCalledWith(PaymentIntentEntity, {
                ...paymentIntentRow(),
                status: "paid",
                appliedAt: PLAN_AT,
            })
        })

        it("changes nothing for an intent that was applied before and says so", async () => {
            const { service } = await build()
            const manager = mockEntityManager({
                findOne: [PaymentIntentEntity, paymentIntentRow({ status: "paid", appliedAt: PLAN_AT })],
            })

            await expect(
                service.markPaidIfNotApplied({ manager, id: "i1", at: PLAN_PERIOD_END }),
            ).resolves.toSucceedWith({
                intent: paymentIntentRow({ status: "paid", appliedAt: PLAN_AT }),
                alreadyApplied: true,
            })

            expect(manager.save).not.toHaveBeenCalled()
        })

        it("refuses an unknown intent and writes nothing", async () => {
            const { service } = await build()
            const manager = mockEntityManager({ findOne: [PaymentIntentEntity, null] })

            await expect(service.markPaidIfNotApplied({ manager, id: "i1", at: PLAN_AT })).resolves.toBeRefused(
                PlanErrorCode.PaymentIntentNotFound,
            )

            expect(manager.save).not.toHaveBeenCalled()
        })
    })

    describe("markFailed", () => {
        it("sets a never-applied intent failed under a row lock", async () => {
            const { service } = await build()
            const manager = mockEntityManager({
                findOne: [PaymentIntentEntity, paymentIntentRow()],
                save: [PaymentIntentEntity, paymentIntentRow({ status: "failed" })],
            })

            await expect(service.markFailed({ manager, id: "i1", at: PLAN_AT })).resolves.toSucceedWith(
                paymentIntentRow({ status: "failed" }),
            )

            expect(manager.findOne).toHaveBeenCalledWith(PaymentIntentEntity, LOCK)
            expect(manager.save).toHaveBeenCalledWith(PaymentIntentEntity, { ...paymentIntentRow(), status: "failed" })
        })

        it("never overturns an intent that was applied", async () => {
            const { service } = await build()
            const manager = mockEntityManager({
                findOne: [PaymentIntentEntity, paymentIntentRow({ status: "paid", appliedAt: PLAN_AT })],
            })

            await expect(service.markFailed({ manager, id: "i1", at: PLAN_PERIOD_END })).resolves.toSucceedWith(
                paymentIntentRow({ status: "paid", appliedAt: PLAN_AT }),
            )

            expect(manager.save).not.toHaveBeenCalled()
        })

        it("refuses an unknown intent", async () => {
            const { service } = await build()
            const manager = mockEntityManager({ findOne: [PaymentIntentEntity, null] })

            await expect(service.markFailed({ manager, id: "i1", at: PLAN_AT })).resolves.toBeRefused(
                PlanErrorCode.PaymentIntentNotFound,
            )

            expect(manager.save).not.toHaveBeenCalled()
        })
    })
})
