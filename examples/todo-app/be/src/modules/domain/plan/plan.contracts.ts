import type { EntityManager } from "typeorm"

/** The two plans of the catalog. */
export type PlanTier = "free" | "paid"

/** The lifecycle states of a subscription; a lapsed row reads as free without ever being rewritten. */
export type SubscriptionStatus = "free" | "pending" | "active" | "past-due" | "lapsed"

/** The states of a payment intent. */
export type PaymentIntentStatus = "pending" | "paid" | "failed"

/** One plan of the fixed catalog: the free plan caps the active tasks, the paid plan does not. */
export interface PlanDefinition {
    /** The plan id. */
    readonly id: PlanTier
    /** How many active tasks the plan allows, null for no cap. */
    readonly taskCap: number | null
}

/** The verdict of the cap guard for one more active task. */
export type CapVerdict =
    { readonly allowed: true } | { readonly allowed: false; readonly cap: number; readonly upgradePath: string }

/** What the cap guard needs to decide. */
export interface CapCheckParams {
    /** The person who wants one more active task. */
    readonly personId: string
    /** How many active tasks the person holds now. */
    readonly activeTaskCount: number
}

/** A subscription as callers see it: one per person. */
export interface SubscriptionView {
    /** The subscription id. */
    readonly id: string
    /** The person the subscription belongs to; bound at creation and never rewritten. */
    readonly personId: string
    /** The plan the row holds. */
    readonly plan: PlanTier
    /** The lifecycle state. */
    readonly status: SubscriptionStatus
    /** When the paid period ends, null while there is none. */
    readonly periodEnd: Date | null
    /** The gateway customer id, null while unknown. */
    readonly gatewayCustomerId: string | null
}

/** A payment intent as callers see it: the ledger entry of one gateway transaction. */
export interface PaymentIntentView {
    /** The intent id: this product id and the idempotency key. */
    readonly id: string
    /** The subscription the payment is for. */
    readonly subscriptionId: string
    /** The gateway that owns the transfer. */
    readonly gateway: string
    /** The id the gateway knows the transaction under. */
    readonly gatewayIntentId: string
    /** The amount in minor units of the currency. */
    readonly amount: number
    /** The currency. */
    readonly currency: string
    /** The state of the intent. */
    readonly status: PaymentIntentStatus
    /** When the intent was applied, null while it was not; set at most once. */
    readonly appliedAt: Date | null
}

/** What reading or lazily creating the subscription of one person needs; the write joins the caller transaction. */
export interface GetOrCreateSubscriptionParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The person. */
    readonly personId: string
}

/** What reading one subscription by id needs; the read joins the transaction when a manager is handed. */
export interface FindSubscriptionParams {
    /** The subscription id. */
    readonly id: string
    /** The transaction manager of the caller, absent for a plain read. */
    readonly manager?: EntityManager
}

/** What reading the effective plan of one person needs. */
export interface ReadPlanParams {
    /** The person. */
    readonly personId: string
}

/** What a subscription transition needs; the write joins the caller transaction. */
export interface TransitionSubscriptionParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The subscription, as read before the decision. */
    readonly subscription: SubscriptionView
}

/** What confirming a payment on a subscription needs. */
export interface ConfirmSubscriptionParams extends TransitionSubscriptionParams {
    /** The end of the paid period the gateway confirmed. */
    readonly periodEnd: Date
}

/** What opening a payment intent needs; the write joins the caller transaction. */
export interface CreatePaymentIntentParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The subscription the payment is for. */
    readonly subscriptionId: string
    /** The id the gateway gave the transaction. */
    readonly gatewayIntentId: string
    /** The amount in minor units. */
    readonly amount: number
    /** The currency. */
    readonly currency: string
}

/** What reading one payment intent by id needs. */
export interface FindPaymentIntentParams {
    /** The intent id. */
    readonly id: string
    /** The transaction manager of the caller, absent for a plain read. */
    readonly manager?: EntityManager
}

/** What reading one payment intent by the gateway id needs. */
export interface FindPaymentIntentByGatewayParams {
    /** The id the gateway knows the transaction under. */
    readonly gatewayIntentId: string
    /** The transaction manager of the caller, absent for a plain read. */
    readonly manager?: EntityManager
}

/** What applying or failing one intent needs; the write joins the caller transaction. */
export interface SettleIntentParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The intent id. */
    readonly id: string
    /** The instant of the settlement. */
    readonly at: Date
}

/** The intent after an apply attempt, and whether this call was the one that applied it. */
export interface AppliedIntent {
    /** The intent. */
    readonly intent: PaymentIntentView
    /** True when the intent had been applied before this call, so nothing was written. */
    readonly alreadyApplied: boolean
}

/** What settling a gateway outcome needs; the writes join the caller transaction. */
export interface ApplyGatewayOutcomeParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The id the gateway knows the transaction under. */
    readonly gatewayIntentId: string
    /** What the gateway reported. */
    readonly outcome: "paid" | "failed"
    /** The end of the paid period the gateway confirmed, absent for the default period. */
    readonly periodEnd: Date | undefined
    /** The instant of the settlement. */
    readonly at: Date
}

/** What settling a gateway outcome changed. */
export interface SettlementView {
    /** True when this call activated the subscription. */
    readonly applied: boolean
    /** The status of the subscription afterwards. */
    readonly subscriptionStatus: SubscriptionStatus
}

/** The answer of a subscription lookup: the subscription, or null when there is none with that id. */
export type SubscriptionLookupResult = SubscriptionView | null

/** The answer of a payment intent lookup: the intent, or null when there is none. */
export type PaymentIntentLookupResult = PaymentIntentView | null

/** What opening the checkout of the paid plan needs. */
export interface UpgradeParams {
    /** The person who upgrades. */
    readonly personId: string
}

/** Where the checkout stands after it was opened. */
export interface CheckoutView {
    /** The subscription of the person. */
    readonly subscriptionId: string
    /** The payment intent to reconcile later. */
    readonly paymentIntentId: string
    /** Where the person completes the payment. */
    readonly checkoutUrl: string
    /** The subscription status after the checkout started. */
    readonly status: SubscriptionStatus
}

/** What returning a person to the free plan needs. */
export interface DowngradeParams {
    /** The person who downgrades. */
    readonly personId: string
}

/** The subscription after the downgrade. */
export interface DowngradeView {
    /** The subscription of the person. */
    readonly subscriptionId: string
    /** The plan the subscription holds afterwards. */
    readonly plan: PlanTier
    /** The subscription status afterwards. */
    readonly status: SubscriptionStatus
}

/** What polling the gateway for one payment intent of a person needs. */
export interface ReconcileParams {
    /** The person who asks; the intent must belong to their subscription. */
    readonly personId: string
    /** The payment intent id. */
    readonly paymentIntentId: string
}

/** What the gateway said and what it caused. */
export interface ReconcileView {
    /** The status the gateway reported just now. */
    readonly gatewayStatus: PaymentIntentStatus
    /** True when this call is the one that applied the intent. */
    readonly applied: boolean
    /** The status of the subscription afterwards. */
    readonly subscriptionStatus: SubscriptionStatus
}

/** What one webhook delivery carries: the presented credential and what the gateway reported. */
export interface WebhookDeliveryParams {
    /** The Authorization header as presented, absent when the sender sent none. */
    readonly authorization: string | undefined
    /** The id the gateway knows the transaction under; it is also the id of the delivery. */
    readonly gatewayIntentId: string
    /** What the gateway reported. */
    readonly outcome: "paid" | "failed"
    /** The end of the paid period, absent for the default period. */
    readonly periodEnd?: Date | undefined
}

/** What a webhook delivery caused: ignored, or what the confirmation changed. */
export type WebhookReceipt =
    | { readonly ignored: true }
    | { readonly ignored: false; readonly applied: boolean; readonly subscriptionStatus: SubscriptionStatus }
