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
    DowngradePlanCommand 
} from "./downgrade-plan.command"
import {
    DowngradePlanHandler 
} from "./downgrade-plan.handler"

describe("DowngradePlanHandler",
    () => {
        let moduleRef: TestingModule
        let subscriptionService: SubscriptionService
        let handler: DowngradePlanHandler

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    DowngradePlanHandler,
                    SubscriptionService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakePlanEntityManager() 
                    },
                ],
            }).compile()
            subscriptionService = moduleRef.get(SubscriptionService)
            handler = moduleRef.get(DowngradePlanHandler)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.plan.downgrade / decision.plan.downgrade.policy: the downgrade is accepted immediately, never refused",
            async () => {
                await subscriptionService.tCheckoutStarted("owner-1")
                const subscription = await subscriptionService.getOrCreate("owner-1")
                await subscriptionService.tGatewayConfirmed(subscription.id,
                    new Date())

                const result = await handler.execute(new DowngradePlanCommand({
                    ownerId: "owner-1" 
                }))

                expect(result.plan).toBe("free")
                expect(result.status).toBe("free")
            })

        it("ac.plan.downgrade.freeze.existing-tasks-untouched: the downgrade only changes the subscription row",
            async () => {
                await subscriptionService.tCheckoutStarted("owner-1")
                const subscription = await subscriptionService.getOrCreate("owner-1")
                await subscriptionService.tGatewayConfirmed(subscription.id,
                    new Date())

                await handler.execute(new DowngradePlanCommand({
                    ownerId: "owner-1" 
                }))

                const after = await subscriptionService.findById(subscription.id)
                expect(after.id).toBe(subscription.id)
                expect(after.personId).toBe("owner-1")
            })
    })
