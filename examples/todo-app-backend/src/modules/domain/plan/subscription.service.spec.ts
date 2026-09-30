import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { SubscriptionEntity } from "./persistence/entities/subscription.entity"
import type { SubscriptionView } from "./plan.contracts"
import { SubscriptionService } from "./subscription.service"

const PERIOD_END = new Date("2026-10-30T00:00:00.000Z")

const row = (overrides: Partial<SubscriptionEntity> = {}): SubscriptionEntity => ({
    id: "s1",
    personId: "p1",
    plan: "free",
    status: "free",
    periodEnd: null,
    gatewayCustomerId: null,
    ...overrides,
})

const view = (overrides: Partial<SubscriptionView> = {}): SubscriptionView => ({
    id: "s1",
    personId: "p1",
    plan: "free",
    status: "free",
    periodEnd: null,
    gatewayCustomerId: null,
    ...overrides,
})

const build = async (own: MockEntityManager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [SubscriptionService, { provide: PRIMARY_ENTITY_MANAGER, useValue: own }],
    }).compile()
    return { service: moduleRef.get(SubscriptionService), own }
}

describe("SubscriptionService", () => {
    describe("getOrCreate", () => {
        it("creates a free subscription for a person without one through the manager it was handed", async () => {
            const { service } = await build()
            const manager = mockEntityManager({
                findOneBy: [SubscriptionEntity, null],
                save: [SubscriptionEntity, row()],
            })

            await expect(service.getOrCreate({ manager, personId: "p1" })).resolves.toEqual(view())

            expect(manager.findOneBy).toHaveBeenCalledWith(SubscriptionEntity, { personId: "p1" })
            expect(manager.save).toHaveBeenCalledWith(SubscriptionEntity, {
                id: expect.any(String),
                personId: "p1",
                plan: "free",
                status: "free",
                periodEnd: null,
                gatewayCustomerId: null,
            })
        })

        it("returns the row a person already has and writes nothing", async () => {
            const { service } = await build()
            const active = row({ plan: "paid", status: "active", periodEnd: PERIOD_END })
            const manager = mockEntityManager({ findOneBy: [SubscriptionEntity, active] })

            await expect(service.getOrCreate({ manager, personId: "p1" })).resolves.toEqual(
                view({ plan: "paid", status: "active", periodEnd: PERIOD_END }),
            )

            expect(manager.save).not.toHaveBeenCalled()
        })
    })

    describe("findById", () => {
        it("reads through the manager it was handed and not through its own", async () => {
            const { service, own } = await build()
            const manager = mockEntityManager({ findOneBy: [SubscriptionEntity, row()] })

            await expect(service.findById({ id: "s1", manager })).resolves.toEqual(view())

            expect(manager.findOneBy).toHaveBeenCalledWith(SubscriptionEntity, { id: "s1" })
            expect(own.findOneBy).not.toHaveBeenCalled()
        })

        it("reads through its own manager for a plain read", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [SubscriptionEntity, row()] }))

            await expect(service.findById({ id: "s1" })).resolves.toEqual(view())
        })

        it("answers null for an unknown id", async () => {
            const { service, own } = await build(mockEntityManager({ findOneBy: [SubscriptionEntity, null] }))

            await expect(service.findById({ id: "nope" })).resolves.toBeNull()

            expect(own.findOneBy).toHaveBeenCalledWith(SubscriptionEntity, { id: "nope" })
        })
    })

    describe("readEffectivePlan", () => {
        it("reads a person without a row as free and writes nothing", async () => {
            const { service, own } = await build(mockEntityManager({ findOneBy: [SubscriptionEntity, null] }))

            await expect(service.readEffectivePlan({ personId: "p1" })).resolves.toEqual({ id: "free", taskCap: 20 })

            expect(own.save).not.toHaveBeenCalled()
        })

        it("reads an active subscription as paid without a cap", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [SubscriptionEntity, row({ status: "active" })] }))

            await expect(service.readEffectivePlan({ personId: "p1" })).resolves.toEqual({ id: "paid", taskCap: null })
        })

        it("reads a past-due subscription as paid", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [SubscriptionEntity, row({ status: "past-due" })] }))

            await expect(service.readEffectivePlan({ personId: "p1" })).resolves.toEqual({ id: "paid", taskCap: null })
        })

        it("reads a pending subscription as free", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [SubscriptionEntity, row({ status: "pending" })] }))

            await expect(service.readEffectivePlan({ personId: "p1" })).resolves.toEqual({ id: "free", taskCap: 20 })
        })

        it("reads a lapsed subscription as free without writing to it", async () => {
            const { service, own } = await build(
                mockEntityManager({ findOneBy: [SubscriptionEntity, row({ plan: "paid", status: "lapsed" })] }),
            )

            await expect(service.readEffectivePlan({ personId: "p1" })).resolves.toEqual({ id: "free", taskCap: 20 })

            expect(own.save).not.toHaveBeenCalled()
        })
    })

    describe("checkCap", () => {
        it("allows a task below the cap of the free plan", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [SubscriptionEntity, row()] }))

            await expect(service.checkCap({ personId: "p1", activeTaskCount: 19 })).resolves.toEqual({ allowed: true })
        })

        it("refuses a task at the cap of the free plan and names the cap and the upgrade path", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [SubscriptionEntity, row()] }))

            await expect(service.checkCap({ personId: "p1", activeTaskCount: 20 })).resolves.toEqual({
                allowed: false,
                cap: 20,
                upgradePath: "/plan/usage",
            })
        })

        it("treats a person without a subscription as free", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [SubscriptionEntity, null] }))

            await expect(service.checkCap({ personId: "p1", activeTaskCount: 20 })).resolves.toMatchObject({ allowed: false, cap: 20 })
        })

        it("allows any count on the paid plan", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [SubscriptionEntity, row({ status: "active" })] }))

            await expect(service.checkCap({ personId: "p1", activeTaskCount: 10_000 })).resolves.toEqual({ allowed: true })
        })
    })

    describe("transitions", () => {
        const transition = async (subscription: SubscriptionView, saved: SubscriptionEntity) => {
            const { service, own } = await build()
            const manager = mockEntityManager({ save: [SubscriptionEntity, saved] })
            return { service, own, manager, subscription }
        }

        it("startCheckout moves a free subscription to pending", async () => {
            const { service, own, manager, subscription } = await transition(view(), row({ status: "pending" }))

            await expect(service.startCheckout({ manager, subscription })).resolves.toEqual(view({ status: "pending" }))

            expect(manager.save).toHaveBeenCalledWith(SubscriptionEntity, {
                id: "s1",
                personId: "p1",
                plan: "free",
                status: "pending",
                periodEnd: null,
                gatewayCustomerId: null,
            })
            expect(own.save).not.toHaveBeenCalled()
        })

        it("confirm activates the subscription on the paid plan until the period end", async () => {
            const pending = view({ status: "pending" })
            const { service, manager } = await transition(
                pending,
                row({ plan: "paid", status: "active", periodEnd: PERIOD_END }),
            )

            await expect(service.confirm({ manager, subscription: pending, periodEnd: PERIOD_END })).resolves.toEqual(
                view({ plan: "paid", status: "active", periodEnd: PERIOD_END }),
            )

            expect(manager.save).toHaveBeenCalledWith(SubscriptionEntity, {
                id: "s1",
                personId: "p1",
                plan: "paid",
                status: "active",
                periodEnd: PERIOD_END,
                gatewayCustomerId: null,
            })
        })

        it("abandon returns the subscription to free and clears the period end", async () => {
            const pending = view({ status: "pending" })
            const { service, manager } = await transition(pending, row())

            await expect(service.abandon({ manager, subscription: pending })).resolves.toEqual(view())

            expect(manager.save).toHaveBeenCalledWith(SubscriptionEntity, expect.objectContaining({ status: "free", plan: "free", periodEnd: null }))
        })

        it("markRenewalDue moves an active subscription to past-due", async () => {
            const active = view({ plan: "paid", status: "active", periodEnd: PERIOD_END })
            const { service, manager } = await transition(active, row({ plan: "paid", status: "past-due", periodEnd: PERIOD_END }))

            await expect(service.markRenewalDue({ manager, subscription: active })).resolves.toMatchObject({ status: "past-due" })

            expect(manager.save).toHaveBeenCalledWith(SubscriptionEntity, expect.objectContaining({ status: "past-due", plan: "paid" }))
        })

        it("lapse moves a past-due subscription to lapsed", async () => {
            const due = view({ plan: "paid", status: "past-due", periodEnd: PERIOD_END })
            const { service, manager } = await transition(due, row({ plan: "paid", status: "lapsed", periodEnd: PERIOD_END }))

            await expect(service.lapse({ manager, subscription: due })).resolves.toMatchObject({ status: "lapsed" })

            expect(manager.save).toHaveBeenCalledWith(SubscriptionEntity, expect.objectContaining({ status: "lapsed" }))
        })

        it("downgrade makes an active subscription free at once", async () => {
            const active = view({ plan: "paid", status: "active", periodEnd: PERIOD_END })
            const { service, manager } = await transition(active, row())

            await expect(service.downgrade({ manager, subscription: active })).resolves.toEqual(view())

            expect(manager.save).toHaveBeenCalledWith(SubscriptionEntity, expect.objectContaining({ status: "free", plan: "free", periodEnd: null }))
        })

        it("downgrade makes a past-due subscription free at once", async () => {
            const due = view({ plan: "paid", status: "past-due", periodEnd: PERIOD_END })
            const { service, manager } = await transition(due, row())

            await expect(service.downgrade({ manager, subscription: due })).resolves.toEqual(view())

            expect(manager.save).toHaveBeenCalledTimes(1)
        })

        it("downgrade returns a free, pending or lapsed subscription untouched and writes nothing", async () => {
            const { service } = await build()
            const manager = mockEntityManager()
            const untouched: SubscriptionView[] = [view(), view({ status: "pending" }), view({ status: "lapsed" })]

            for (const subscription of untouched) {
                await expect(service.downgrade({ manager, subscription })).resolves.toBe(subscription)
            }

            expect(manager.save).not.toHaveBeenCalled()
        })
    })
})
