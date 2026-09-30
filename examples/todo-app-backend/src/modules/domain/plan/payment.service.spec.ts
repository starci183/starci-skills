import { mockEntityManager } from "@tests/fixtures/database"
import { PlanErrorCode } from "./errors/plan.error"
import { PaymentService } from "./payment.service"
import { PaymentIntentEntity } from "./persistence/entities/payment-intent.entity"
import type { PaymentIntentView } from "./plan.contracts"

const AT = new Date("2026-09-30T10:00:00.000Z")

const pending: PaymentIntentView = {
    id: "i1",
    subscriptionId: "s1",
    gateway: "sepay",
    gatewayIntentId: "g1",
    amount: 99000,
    currency: "VND",
    status: "pending",
    appliedAt: null,
}

const echoSave = (): jest.Mock =>
    jest.fn().mockImplementation((_target: unknown, entity: object) => Promise.resolve(entity))

describe("PaymentService", () => {
    it("records a pending intent with no appliedAt through the manager it was handed", async () => {
        const inTransaction = mockEntityManager({ save: echoSave() })
        const created = await new PaymentService(mockEntityManager()).create({
            manager: inTransaction,
            subscriptionId: "s1",
            gatewayIntentId: "g1",
            amount: 99000,
            currency: "VND",
        })
        expect(created).toMatchObject({
            subscriptionId: "s1",
            gateway: "sepay",
            gatewayIntentId: "g1",
            amount: 99000,
            currency: "VND",
            status: "pending",
            appliedAt: null,
        })
        expect(inTransaction.save).toHaveBeenCalledWith(PaymentIntentEntity, expect.objectContaining({ status: "pending" }))
    })

    it("finds an intent by its id and by the id the gateway named, and answers null for an unknown one", async () => {
        const own = mockEntityManager({
            findOneBy: jest.fn().mockResolvedValueOnce({ ...pending }).mockResolvedValueOnce({ ...pending }).mockResolvedValueOnce(null),
        })
        const service = new PaymentService(own)
        await expect(service.findById({ id: "i1" })).resolves.toEqual(pending)
        await expect(service.findByGatewayIntentId({ gatewayIntentId: "g1" })).resolves.toEqual(pending)
        await expect(service.findByGatewayIntentId({ gatewayIntentId: "nope" })).resolves.toBeNull()
        expect(own.findOneBy).toHaveBeenNthCalledWith(1, PaymentIntentEntity, { id: "i1" })
        expect(own.findOneBy).toHaveBeenNthCalledWith(2, PaymentIntentEntity, { gatewayIntentId: "g1" })
    })

    describe("markPaidIfNotApplied", () => {
        it("applies an unapplied intent once, under a row lock", async () => {
            const inTransaction = mockEntityManager({ findOne: jest.fn().mockResolvedValue({ ...pending }), save: echoSave() })
            const outcome = await new PaymentService(mockEntityManager()).markPaidIfNotApplied({
                manager: inTransaction,
                id: "i1",
                at: AT,
            })
            expect(outcome).toMatchObject({ kind: "ok", value: { alreadyApplied: false, intent: { status: "paid", appliedAt: AT } } })
            expect(inTransaction.findOne).toHaveBeenCalledWith(PaymentIntentEntity, {
                where: { id: "i1" },
                lock: { mode: "pessimistic_write" },
            })
        })

        it("changes nothing for an intent that was applied before and says so", async () => {
            const applied = { ...pending, status: "paid", appliedAt: AT }
            const inTransaction = mockEntityManager({ findOne: jest.fn().mockResolvedValue(applied), save: jest.fn() })
            const outcome = await new PaymentService(mockEntityManager()).markPaidIfNotApplied({
                manager: inTransaction,
                id: "i1",
                at: new Date("2026-10-01T00:00:00.000Z"),
            })
            expect(outcome).toMatchObject({ kind: "ok", value: { alreadyApplied: true, intent: { appliedAt: AT } } })
            expect(inTransaction.save).not.toHaveBeenCalled()
        })

        it("refuses an unknown intent", async () => {
            const inTransaction = mockEntityManager({ findOne: jest.fn().mockResolvedValue(null), save: jest.fn() })
            const outcome = await new PaymentService(mockEntityManager()).markPaidIfNotApplied({
                manager: inTransaction,
                id: "nope",
                at: AT,
            })
            expect(outcome).toMatchObject({ kind: "refused", code: PlanErrorCode.PaymentIntentNotFound })
            expect(inTransaction.save).not.toHaveBeenCalled()
        })
    })

    describe("markFailed", () => {
        it("sets a never-applied intent failed", async () => {
            const inTransaction = mockEntityManager({ findOne: jest.fn().mockResolvedValue({ ...pending }), save: echoSave() })
            const outcome = await new PaymentService(mockEntityManager()).markFailed({ manager: inTransaction, id: "i1", at: AT })
            expect(outcome).toMatchObject({ kind: "ok", value: { status: "failed", appliedAt: null } })
        })

        it("never overturns an intent that was applied", async () => {
            const applied = { ...pending, status: "paid", appliedAt: AT }
            const inTransaction = mockEntityManager({ findOne: jest.fn().mockResolvedValue(applied), save: jest.fn() })
            const outcome = await new PaymentService(mockEntityManager()).markFailed({ manager: inTransaction, id: "i1", at: AT })
            expect(outcome).toMatchObject({ kind: "ok", value: { status: "paid", appliedAt: AT } })
            expect(inTransaction.save).not.toHaveBeenCalled()
        })

        it("refuses an unknown intent", async () => {
            const inTransaction = mockEntityManager({ findOne: jest.fn().mockResolvedValue(null) })
            const outcome = await new PaymentService(mockEntityManager()).markFailed({ manager: inTransaction, id: "nope", at: AT })
            expect(outcome).toMatchObject({ kind: "refused", code: PlanErrorCode.PaymentIntentNotFound })
        })
    })
})
