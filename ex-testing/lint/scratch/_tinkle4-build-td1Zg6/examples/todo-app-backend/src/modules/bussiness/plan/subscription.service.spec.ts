import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/primary/constants/connection"
import {
    createFakePlanEntityManager 
} from "./testing/fake-plan-entity-manager"
import {
    SubscriptionService 
} from "./subscription.service"
import {
    FREE_PLAN, PAID_PLAN 
} from "./types/plan-catalog"

describe("SubscriptionService",
    () => {
        let moduleRef: TestingModule
        let service: SubscriptionService

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    SubscriptionService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakePlanEntityManager() 
                    },
                ],
            }).compile()
            service = moduleRef.get(SubscriptionService)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("data.plan.subscription: a person with no row yet is lazily given exactly one, starting free",
            async () => {
                const record = await service.getOrCreate("person-1")
                expect(record.plan).toBe("free")
                expect(record.status).toBe("free")
                const again = await service.getOrCreate("person-1")
                expect(again.id).toBe(record.id)
            })

        it("sds.plan.subscription-lifecycle t-checkout-started: free -> pending",
            async () => {
                const record = await service.getOrCreate("person-1")
                const started = await service.tCheckoutStarted("person-1")
                expect(started.id).toBe(record.id)
                expect(started.status).toBe("pending")
            })

        it("sds.plan.subscription-lifecycle t-gateway-confirmed: pending -> active, periodEnd set, plan paid",
            async () => {
                const record = await service.getOrCreate("person-1")
                await service.tCheckoutStarted("person-1")
                const periodEnd = new Date("2027-01-01T00:00:00.000Z")
                const confirmed = await service.tGatewayConfirmed(record.id,
                    periodEnd)
                expect(confirmed.status).toBe("active")
                expect(confirmed.plan).toBe("paid")
                expect(confirmed.periodEnd).toEqual(periodEnd)
            })

        it("sds.plan.subscription-lifecycle t-gateway-abandoned: pending -> free, periodEnd cleared",
            async () => {
                const record = await service.getOrCreate("person-1")
                await service.tCheckoutStarted("person-1")
                const abandoned = await service.tGatewayAbandoned(record.id)
                expect(abandoned.status).toBe("free")
                expect(abandoned.plan).toBe("free")
                expect(abandoned.periodEnd).toBeNull()
            })

        it("sds.plan.subscription-lifecycle t-renewal-due then t-lapse: active -> past-due -> lapsed",
            async () => {
                const record = await service.getOrCreate("person-1")
                await service.tCheckoutStarted("person-1")
                await service.tGatewayConfirmed(record.id,
                    new Date())
                const dueRow = await service.tRenewalDue(record.id)
                expect(dueRow.status).toBe("past-due")
                const lapsedRow = await service.tLapse(record.id)
                expect(lapsedRow.status).toBe("lapsed")
            })

        it("sds.plan.subscription-lifecycle t-renewal-confirmed: past-due -> active, periodEnd extended",
            async () => {
                const record = await service.getOrCreate("person-1")
                await service.tCheckoutStarted("person-1")
                await service.tGatewayConfirmed(record.id,
                    new Date("2027-01-01T00:00:00.000Z"))
                await service.tRenewalDue(record.id)
                const renewed = await service.tRenewalConfirmed(record.id,
                    new Date("2027-02-01T00:00:00.000Z"))
                expect(renewed.status).toBe("active")
                expect(renewed.periodEnd).toEqual(new Date("2027-02-01T00:00:00.000Z"))
            })

        it("br.plan.lapse.reverts-on-read / ac.plan.lapse.reverts-on-read.read-after-grace-is-free: a lapsed row reads as free without writing to it",
            async () => {
                const record = await service.getOrCreate("person-1")
                await service.tCheckoutStarted("person-1")
                await service.tGatewayConfirmed(record.id,
                    new Date())
                await service.tRenewalDue(record.id)
                await service.tLapse(record.id)

                const effective = await service.readEffectivePlan("person-1")
                expect(effective).toEqual(FREE_PLAN)

                const stored = await service.findById(record.id)
                expect(stored.status).toBe("lapsed")
            })

        it("t-revert-on-read: active and past-due both read as the paid plan",
            async () => {
                const record = await service.getOrCreate("person-1")
                await service.tCheckoutStarted("person-1")
                await service.tGatewayConfirmed(record.id,
                    new Date())
                expect(await service.readEffectivePlan("person-1")).toEqual(PAID_PLAN)

                await service.tRenewalDue(record.id)
                expect(await service.readEffectivePlan("person-1")).toEqual(PAID_PLAN)
            })

        it("br.plan.downgrade.freeze / decision.plan.downgrade.policy t-downgrade: active -> free immediately, never refused",
            async () => {
                const record = await service.getOrCreate("person-1")
                await service.tCheckoutStarted("person-1")
                await service.tGatewayConfirmed(record.id,
                    new Date())

                const downgraded = await service.tDowngrade("person-1")
                expect(downgraded.status).toBe("free")
                expect(downgraded.plan).toBe("free")
                expect(downgraded.periodEnd).toBeNull()
            })

        it("t-downgrade from past-due also lands on free",
            async () => {
                const record = await service.getOrCreate("person-1")
                await service.tCheckoutStarted("person-1")
                await service.tGatewayConfirmed(record.id,
                    new Date())
                await service.tRenewalDue(record.id)

                const downgraded = await service.tDowngrade("person-1")
                expect(downgraded.status).toBe("free")
            })

        it("t-downgrade on an already-free person is a no-op, not an error",
            async () => {
                await service.getOrCreate("person-1")
                const downgraded = await service.tDowngrade("person-1")
                expect(downgraded.status).toBe("free")
            })
    })
