import { builder } from "@starci/jest-preset"
import type { PaymentIntentView, SubscriptionView, WebhookDeliveryParams } from "@modules/domain/plan"

/** The instant the plan specs settle and stamp at. */
export const PLAN_AT = new Date("2026-09-30T10:00:00.000Z")

/** The end of the paid period the plan specs confirm. */
export const PLAN_PERIOD_END = new Date("2026-10-30T00:00:00.000Z")

/** A subscription row (and view) of a person on the free plan; override the plan, status or period a spec is about. */
export const subscriptionRow = builder<SubscriptionView>({
    id: "s1",
    personId: "p1",
    plan: "free",
    status: "free",
    periodEnd: null,
    gatewayCustomerId: null,
})

/** A pending payment intent row (and view) of the default subscription. */
export const paymentIntentRow = builder<PaymentIntentView>({
    id: "i1",
    subscriptionId: "s1",
    gateway: "sepay",
    gatewayIntentId: "g1",
    amount: 99000,
    currency: "VND",
    status: "pending",
    appliedAt: null,
})

/** One authorised webhook delivery reporting a paid intent. */
export const webhookDelivery = builder<WebhookDeliveryParams>({
    authorization: "Bearer shared-secret",
    gatewayIntentId: "g1",
    outcome: "paid",
    periodEnd: PLAN_PERIOD_END,
})
