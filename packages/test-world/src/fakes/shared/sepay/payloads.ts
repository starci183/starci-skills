/**
 * Typed builders of every SePay body: the todo integration's intent bodies (create, transaction pending/settled, webhook) and
 * the documented SePay bank-transfer webhook transaction.
 */

/** A payment intent the SePay fake created. */
export interface SepayIntent {
    /** The transaction id the fake handed out. */
    readonly gatewayIntentId: string
    /** The reference the caller sent: the id of the subscription that is paid for. */
    readonly reference: string
    /** The amount in minor units. */
    readonly amount: number
    /** The currency. */
    readonly currency: string
    /** The checkout URL the fake answered. */
    readonly checkoutUrl: string
    /** What the gateway now reports for the transaction. */
    readonly status: "pending" | "paid" | "failed"
    /** The end of the paid period the gateway reports, ISO 8601, or null while pending. */
    readonly periodEnd: string | null
}

/** What settling a transaction at the SePay fake takes. */
export interface SettleParams {
    /** The transaction. */
    readonly gatewayIntentId: string
    /** What the gateway reports from now on. */
    readonly status: "paid" | "failed"
    /** The end of the paid period, ISO 8601; the fake picks thirty days ahead when absent. */
    readonly periodEnd?: string
}

/** A settle that is delivered after a delay. */
export interface DelayedSettleParams extends SettleParams {
    /** How long the fake waits before it calls the app, in milliseconds. */
    readonly delayMs: number
}

/** The body of the todo integration's create call. */
export interface SepayCreateRequest {
    readonly reference: string
    readonly amount: number
    readonly currency: string
}

/** The create answer: `{ id, qrCodeUrl }`. */
export const sepayCreateResponse = (id: string, checkoutUrl: string): { readonly id: string; readonly qrCodeUrl: string } => ({ id, qrCodeUrl: checkoutUrl })

/** The transaction answer while pending. */
export const sepayTransactionPending = (id: string): { readonly id: string; readonly status: "pending" } => ({ id, status: "pending" })

/** The transaction answer once settled. */
export const sepayTransactionSettled = (
    id: string,
    status: "paid" | "failed",
    periodEnd: string,
): { readonly id: string; readonly status: "paid" | "failed"; readonly periodEnd: string } => ({ id, status, periodEnd })

/** The body of the todo integration's webhook (same shape as the settled transaction). */
export const sepayIntentWebhook = sepayTransactionSettled

/** The transaction body of SePay's documented bank-transfer webhook. */
export interface SepayTransactionWebhook {
    readonly id: number
    readonly gateway: string
    readonly transactionDate: string
    readonly accountNumber: string
    readonly code: string | null
    readonly content: string
    readonly transferType: "in" | "out"
    readonly transferAmount: number
    readonly accumulated: number
    readonly subAccount: string | null
    readonly referenceCode: string
    readonly description: string
}

/** What the transaction webhook is built from. */
export interface SepayTransactionInput {
    readonly id: number
    /** The payment code the payer wrote in the transfer content: the reference of the intent. */
    readonly code: string
    readonly amount: number
    readonly transactionDate: string
    readonly accumulated?: number
    readonly gateway?: string
    readonly accountNumber?: string
    readonly transferType?: "in" | "out"
}

/** The documented SePay webhook transaction. */
export const sepayTransactionWebhook = (input: SepayTransactionInput): SepayTransactionWebhook => ({
    id: input.id,
    gateway: input.gateway ?? "Vietcombank",
    transactionDate: input.transactionDate,
    accountNumber: input.accountNumber ?? "0123456789",
    code: input.code,
    content: `Thanh toan ${input.code}`,
    transferType: input.transferType ?? "in",
    transferAmount: input.amount,
    accumulated: input.accumulated ?? input.amount,
    subAccount: null,
    referenceCode: `FT${String(input.id).padStart(10, "0")}`,
    description: `BankAPINotify Thanh toan ${input.code}`,
})
