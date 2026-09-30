import { mockEntityManager } from "@tests/fixtures/database"
import type { SubscriptionView } from "./plan.contracts"
import { FREE_PLAN, PAID_PLAN } from "./plan.policy"
import { SubscriptionEntity } from "./persistence/entities/subscription.entity"
import { SubscriptionService } from "./subscription.service"

const PERIOD_END = new Date("2026-10-30T00:00:00.000Z")

const free: SubscriptionView = {
    id: "s1",
    personId: "p1",
    plan: "free",
    status: "free",
    periodEnd: null,
    gatewayCustomerId: null,
}
const active: SubscriptionView = { ...free, plan: "paid", status: "active", periodEnd: PERIOD_END }

const echoSave = (): jest.Mock =>
    jest.fn().mockImplementation((_target: unknown, entity: object) => Promise.resolve(entity))

describe("SubscriptionService", () => {
    describe("getOrCreate", () => {
        it("gives a person without a row exactly one, free, through the manager it was handed", async () => {
            const inTransaction = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(null), save: echoSave() })
            const own = mockEntityManager()
            const created = await new SubscriptionService(own).getOrCreate({ manager: inTransaction, personId: "p1" })
            expect(created).toMatchObject({ personId: "p1", plan: "free", status: "free", periodEnd: null })
            expect(inTransaction.save).toHaveBeenCalledWith(SubscriptionEntity, expect.objectContaining({ personId: "p1" }))
            expect(own.save).not.toHaveBeenCalled()
        })

        it("returns the row a person already has and writes nothing", async () => {
            const inTransaction = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue({ ...active }), save: jest.fn() })
            await expect(
                new SubscriptionService(mockEntityManager()).getOrCreate({ manager: inTransaction, personId: "p1" }),
            ).resolves.toEqual(active)
            expect(inTransaction.findOneBy).toHaveBeenCalledWith(SubscriptionEntity, { personId: "p1" })
            expect(inTransaction.save).not.toHaveBeenCalled()
        })
    })

    describe("findById", () => {
        it("reads through the handed manager when there is one and answers null for an unknown id", async () => {
            const own = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(null) })
            const inTransaction = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue({ ...free }) })
            const service = new SubscriptionService(own)
            await expect(service.findById({ id: "s1", manager: inTransaction })).resolves.toEqual(free)
            await expect(service.findById({ id: "nope" })).resolves.toBeNull()
            expect(own.findOneBy).toHaveBeenCalledWith(SubscriptionEntity, { id: "nope" })
        })
    })

    describe("readEffectivePlan", () => {
        const planOf = async (row: SubscriptionView | null): Promise<unknown> => {
            const own = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(row), save: jest.fn() })
            const plan = await new SubscriptionService(own).readEffectivePlan({ personId: "p1" })
            expect(own.save).not.toHaveBeenCalled()
            return plan
        }

        it("reads a person without a row as free and writes nothing", async () => {
            await expect(planOf(null)).resolves.toBe(FREE_PLAN)
        })

        it("reads active and past-due as paid", async () => {
            await expect(planOf(active)).resolves.toBe(PAID_PLAN)
            await expect(planOf({ ...active, status: "past-due" })).resolves.toBe(PAID_PLAN)
        })

        it("reads pending and a lapsed row as free without writing to it", async () => {
            await expect(planOf({ ...free, status: "pending" })).resolves.toBe(FREE_PLAN)
            await expect(planOf({ ...active, status: "lapsed" })).resolves.toBe(FREE_PLAN)
        })
    })

    describe("transitions", () => {
        const run = async (
            act: (service: SubscriptionService, manager: ReturnType<typeof mockEntityManager>) => Promise<SubscriptionView>,
        ): Promise<SubscriptionView> => {
            const own = mockEntityManager({ save: jest.fn() })
            const inTransaction = mockEntityManager({ save: echoSave() })
            const result = await act(new SubscriptionService(own), inTransaction)
            expect(own.save).not.toHaveBeenCalled()
            return result
        }

        it("startCheckout: free to pending", async () => {
            const result = await run((service, manager) => service.startCheckout({ manager, subscription: free }))
            expect(result).toEqual({ ...free, status: "pending" })
        })

        it("confirm: pending to active on the paid plan with the period end", async () => {
            const pending: SubscriptionView = { ...free, status: "pending" }
            const result = await run((service, manager) =>
                service.confirm({ manager, subscription: pending, periodEnd: PERIOD_END }),
            )
            expect(result).toEqual(active)
        })

        it("confirm: past-due to active with the period extended", async () => {
            const later = new Date("2026-11-30T00:00:00.000Z")
            const result = await run((service, manager) =>
                service.confirm({ manager, subscription: { ...active, status: "past-due" }, periodEnd: later }),
            )
            expect(result).toMatchObject({ status: "active", plan: "paid", periodEnd: later })
        })

        it("abandon: pending to free with the period end cleared", async () => {
            const result = await run((service, manager) =>
                service.abandon({ manager, subscription: { ...free, status: "pending" } }),
            )
            expect(result).toEqual(free)
        })

        it("markRenewalDue then lapse: active to past-due to lapsed", async () => {
            const due = await run((service, manager) => service.markRenewalDue({ manager, subscription: active }))
            expect(due.status).toBe("past-due")
            const lapsed = await run((service, manager) => service.lapse({ manager, subscription: due }))
            expect(lapsed.status).toBe("lapsed")
        })

        it("downgrade: active and past-due become free at once", async () => {
            const fromActive = await run((service, manager) => service.downgrade({ manager, subscription: active }))
            expect(fromActive).toEqual(free)
            const fromDue = await run((service, manager) =>
                service.downgrade({ manager, subscription: { ...active, status: "past-due" } }),
            )
            expect(fromDue).toEqual(free)
        })

        it("downgrade: a free, pending or lapsed subscription is returned untouched and nothing is written", async () => {
            const manager = mockEntityManager({ save: jest.fn() })
            const service = new SubscriptionService(mockEntityManager())
            for (const status of ["free", "pending", "lapsed"] as const) {
                const subscription: SubscriptionView = { ...free, status }
                await expect(service.downgrade({ manager, subscription })).resolves.toBe(subscription)
            }
            expect(manager.save).not.toHaveBeenCalled()
        })
    })
})
