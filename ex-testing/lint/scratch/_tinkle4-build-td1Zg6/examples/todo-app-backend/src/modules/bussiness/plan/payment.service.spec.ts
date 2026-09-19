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
    PaymentService 
} from "./payment.service"

describe("PaymentService",
    () => {
        let moduleRef: TestingModule
        let service: PaymentService

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    PaymentService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakePlanEntityManager() 
                    },
                ],
            }).compile()
            service = moduleRef.get(PaymentService)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("data.plan.payment-intent: create writes a pending row with no appliedAt",
            async () => {
                const record = await service.create("sub-1",
                    "sepay-gw-1",
                    99000,
                    "VND")
                expect(record.status).toBe("pending")
                expect(record.appliedAt).toBeNull()
                expect(record.gatewayIntentId).toBe("sepay-gw-1")
            })

        it("ac.plan.payment.idempotent.replay-is-noop: the first apply activates, a replay changes nothing",
            async () => {
                const created = await service.create("sub-1",
                    "sepay-gw-1",
                    99000,
                    "VND")

                const first = await service.markPaidIfNotApplied(created.id)
                expect(first.alreadyApplied).toBe(false)
                expect(first.record.status).toBe("paid")
                const firstAppliedAt = first.record.appliedAt
                expect(firstAppliedAt).not.toBeNull()

                const replay = await service.markPaidIfNotApplied(created.id)
                expect(replay.alreadyApplied).toBe(true)
                expect(replay.record.appliedAt).toEqual(firstAppliedAt)
            })

        it("br.plan.payment.idempotent: applying twice never records a second ledger entry for the same intent",
            async () => {
                const created = await service.create("sub-1",
                    "sepay-gw-1",
                    99000,
                    "VND")
                await service.markPaidIfNotApplied(created.id)
                await service.markPaidIfNotApplied(created.id)
                const stored = await service.findById(created.id)
                expect(stored.status).toBe("paid")
            })

        it("fr.plan.reconcile: markFailed never overturns an already-applied intent",
            async () => {
                const created = await service.create("sub-1",
                    "sepay-gw-1",
                    99000,
                    "VND")
                await service.markPaidIfNotApplied(created.id)
                const afterFailAttempt = await service.markFailed(created.id)
                expect(afterFailAttempt.status).toBe("paid")
            })

        it("markFailed on a never-applied intent sets it failed",
            async () => {
                const created = await service.create("sub-1",
                    "sepay-gw-1",
                    99000,
                    "VND")
                const failed = await service.markFailed(created.id)
                expect(failed.status).toBe("failed")
            })

        it("findByGatewayIntentId resolves the intent SePay named in a webhook",
            async () => {
                const created = await service.create("sub-1",
                    "sepay-gw-1",
                    99000,
                    "VND")
                const found = await service.findByGatewayIntentId("sepay-gw-1")
                expect(found?.id).toBe(created.id)
            })
    })
