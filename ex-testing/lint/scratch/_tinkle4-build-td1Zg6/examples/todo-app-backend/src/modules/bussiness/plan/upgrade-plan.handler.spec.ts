import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    SepayClient, SepayCreateIntentParams, SepayCreateIntentResult 
} from "@modules/integrations/sepay/sepay.client"
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
    PaymentService 
} from "./payment.service"
import {
    UpgradePlanCommand 
} from "./upgrade-plan.command"
import {
    UpgradePlanHandler 
} from "./upgrade-plan.handler"

/** integration.plan.sepay: the in-process fake this handler's own unit tests exercise against, standing
 * in for the real create-intent round-trip without asserting anything about SePay's own implementation -
 * matches session's FakeKeycloakClient (sign-in.handler.spec.ts) exactly. */
class FakeSepayClient extends SepayClient {
    public createIntentCalls: Array<SepayCreateIntentParams> = []

    constructor() {
        super(new AppConfigService())
    }

    async createIntent(params: SepayCreateIntentParams): Promise<SepayCreateIntentResult> {
        this.createIntentCalls.push(params)
        return {
            gatewayIntentId: `fake-gw-${params.subscriptionId}`, checkoutUrl: `https://my.sepay.vn/qr/fake-${params.subscriptionId}` 
        }
    }
}

describe("UpgradePlanHandler",
    () => {
        let moduleRef: TestingModule
        let subscriptionService: SubscriptionService
        let paymentService: PaymentService
        let sepayClient: FakeSepayClient
        let handler: UpgradePlanHandler

        beforeEach(async () => {
            sepayClient = new FakeSepayClient()
            moduleRef = await Test.createTestingModule({
                providers: [
                    UpgradePlanHandler,
                    SubscriptionService,
                    PaymentService,
                    AppConfigService,
                    {
                        provide: SepayClient, useValue: sepayClient 
                    },
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakePlanEntityManager() 
                    },
                ],
            }).compile()
            subscriptionService = moduleRef.get(SubscriptionService)
            paymentService = moduleRef.get(PaymentService)
            handler = moduleRef.get(UpgradePlanHandler)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.plan.upgrade mainFlow t-checkout-started: the subscription becomes pending and a payment intent is created",
            async () => {
                const result = await handler.execute(new UpgradePlanCommand({
                    ownerId: "owner-1" 
                }))

                expect(result.status).toBe("pending")
                expect(result.checkoutUrl).toContain("https://")
                expect(sepayClient.createIntentCalls).toHaveLength(1)

                const subscription = await subscriptionService.findById(result.subscriptionId)
                expect(subscription.status).toBe("pending")

                const paymentIntent = await paymentService.findById(result.paymentIntentId)
                expect(paymentIntent.status).toBe("pending")
                expect(paymentIntent.subscriptionId).toBe(result.subscriptionId)
            })

        it("data.plan.payment-intent: the created intent carries the catalog price and currency",
            async () => {
                const result = await handler.execute(new UpgradePlanCommand({
                    ownerId: "owner-1" 
                }))
                const paymentIntent = await paymentService.findById(result.paymentIntentId)
                expect(paymentIntent.amount).toBe(moduleRef.get(AppConfigService).getPaidPlanPriceMinorUnits())
                expect(paymentIntent.currency).toBe("VND")
            })
    })
