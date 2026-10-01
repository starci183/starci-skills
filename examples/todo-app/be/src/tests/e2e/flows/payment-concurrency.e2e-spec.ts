import { PAYMENT_INTENT_BY_ID, SUBSCRIPTIONS_OF_PERSON } from "@tests/fixtures/persistence/e2e-verification.sql"
import type { PaymentIntentRow, SubscriptionRow } from "@tests/fixtures/persistence/e2e-verification.rows"
import type { UpgradePlanData } from "@tests/fixtures/views/e2e-views.contracts"
import { webhookAnswerOf } from "@tests/world/kit/webhook-answer"
import { worldClock } from "@tests/world/kit/world-clock"
import { useTestWorld } from "@tests/world/use-test-world"

const CONCURRENT_DELIVERIES = 8
const PERIOD_MS = 30 * 86_400_000

/**
 * plan: a payment confirmed by many concurrent deliveries is applied exactly once. The gateway retries a webhook and the
 * reconcile poll can race it: however many signed deliveries reach the door at the same instant, the idempotent ledger lets
 * exactly one of them activate the subscription and leaves the rest as harmless replays. The deliveries are the ones the
 * gateway fake sends to the real webhook door over HTTP; the stored rows verify the outcome.
 */
describe("plan: concurrent payment confirmation (e2e)", () => {
    const world = useTestWorld({ apps: ["todo"] })

    it("one checkout, eight simultaneous paid confirmations: exactly one applies, the subscription is active once", async () => {
        const person = await world.signedInPerson("payment-race")

        const upgraded = await person.caller.graphql<UpgradePlanData>("upgradePlan")
        expect(upgraded.errorCode).toBeNull()
        const checkout = upgraded.data?.upgradePlan
        expect(checkout?.status).toBe("pending")
        const intent = (await world.fake.sepay.intents()).find(
            (candidate) => candidate.reference === checkout?.subscriptionId,
        )
        const gatewayIntentId = intent?.gatewayIntentId ?? ""
        expect(gatewayIntentId).not.toBe("")

        const periodEnd = new Date(worldClock.now().getTime() + PERIOD_MS).toISOString()
        const deliveries = await Promise.all(
            Array.from({ length: CONCURRENT_DELIVERIES }, () =>
                world.fake.sepay.settle({ gatewayIntentId, status: "paid", periodEnd }),
            ),
        )

        // Every delivery was accepted by the door, and exactly one of them activated the subscription.
        expect(deliveries.map((delivery) => delivery?.status)).toEqual(
            Array.from({ length: CONCURRENT_DELIVERIES }, () => 200),
        )
        expect(deliveries.filter((delivery) => webhookAnswerOf(delivery).applied === true)).toHaveLength(1)

        // The store holds one active paid subscription and one paid intent.
        const subscriptions: Array<SubscriptionRow> = await world.db.primary.query(SUBSCRIPTIONS_OF_PERSON, [
            person.personId,
        ])
        expect(subscriptions).toEqual([{ id: checkout?.subscriptionId, plan: "paid", status: "active" }])
        const intents: Array<PaymentIntentRow> = await world.db.primary.query(PAYMENT_INTENT_BY_ID, [
            checkout?.paymentIntentId,
        ])
        expect(intents[0]?.status).toBe("paid")
    })
})
