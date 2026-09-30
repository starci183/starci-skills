import { randomUUID } from "node:crypto"
import type { Principal } from "@modules/platform/cqrs"
import { ConfirmPaymentCommand } from "@features/todo/application/confirm-payment.command"
import { UpgradePlanCommand } from "@features/todo/application/upgrade-plan.command"
import { TodoModule } from "@features/todo/todo.module"
import { PAYMENT_INTENT_BY_ID, SUBSCRIPTIONS_OF_PERSON } from "@tests/fixtures/persistence/e2e-verification.sql"
import type { PaymentIntentRow, SubscriptionRow } from "@tests/fixtures/persistence/e2e-verification.rows"
import { TODO_CAPABILITY_MODULES } from "@tests/world/test-capabilities.options"
import { useTestWorld } from "@tests/world/use-test-world"

const CONCURRENT_DELIVERIES = 8
const PERIOD_MS = 30 * 86_400_000

/**
 * plan: a payment confirmed by many concurrent deliveries is applied exactly once. Integration level: the real capability
 * modules and the real handlers of the todo feature over the shared Postgres, dispatched on the command bus (no HTTP, no
 * worker); the payment gateway is the fake at the network edge, reached by the real SePay client. The gateway retries a
 * webhook and the reconcile poll can race it: however many deliveries arrive at the same instant, the idempotent ledger lets
 * exactly one of them activate the subscription and leaves the rest as harmless replays.
 */
describe("plan: concurrent payment confirmation (integration)", () => {
    const world = useTestWorld({ modules: [...TODO_CAPABILITY_MODULES, () => ({ module: TodoModule })] })

    it("one checkout, eight simultaneous paid confirmations: exactly one applies, the subscription is active once", async () => {
        const principal: Principal = { id: randomUUID(), roles: ["member"] }

        const checkout = await world.commandBus.execute(new UpgradePlanCommand({ request: {}, principal }))
        expect(checkout.status).toBe("pending")
        const intent = (await world.fake.sepay.intents()).find((candidate) => candidate.reference === checkout.subscriptionId)
        const gatewayIntentId = intent?.gatewayIntentId ?? ""
        expect(gatewayIntentId).not.toBe("")

        const periodEnd = new Date(Date.now() + PERIOD_MS)
        const outcomes = await Promise.all(
            Array.from({ length: CONCURRENT_DELIVERIES }, () =>
                world.commandBus.execute(new ConfirmPaymentCommand({ request: { gatewayIntentId, outcome: "paid", periodEnd } })),
            ),
        )

        // Nothing was refused, and exactly one delivery activated the subscription.
        expect(outcomes.filter((outcome) => outcome.kind === "refused")).toEqual([])
        const applied = outcomes.filter((outcome) => outcome.kind === "ok" && outcome.value.applied)
        expect(applied).toHaveLength(1)

        // The store holds one active paid subscription and one paid intent.
        const subscriptions: Array<SubscriptionRow> = await world.db.primary.query(SUBSCRIPTIONS_OF_PERSON, [principal.id])
        expect(subscriptions).toEqual([{ id: checkout.subscriptionId, plan: "paid", status: "active" }])
        const intents: Array<PaymentIntentRow> = await world.db.primary.query(PAYMENT_INTENT_BY_ID, [checkout.paymentIntentId])
        expect(intents[0]?.status).toBe("paid")
    })
})
