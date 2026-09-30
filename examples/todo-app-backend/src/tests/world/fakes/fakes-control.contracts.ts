/**
 * What crosses the control channel between a spec worker and the fakes host that jest globalSetup started. The fakes are
 * servers at the NETWORK EDGE (HTTP or SMTP) in the jest parent process; a spec worker steers and reads them over one
 * small JSON HTTP surface, so the same fakes serve every spec worker of the run.
 */

/** How the next call to a fake fails: an HTTP status or an SMTP reply code, a silence, or a webhook with a wrong signature. */
export interface FailureSpec {
    /** Answer the next inbound call with this status (HTTP) or reply code (SMTP recipient step) instead of serving it. */
    readonly status?: number
    /** Accept the next inbound call and never answer it, so the caller runs into its own deadline. */
    readonly timeout?: boolean
    /** Sign the next webhook delivery with a wrong secret. */
    readonly badSignature?: boolean
    /** SMTP only: fail only a message addressed to this recipient, so another run of the shared fake is not disturbed. */
    readonly recipient?: string
}

/** One call a fake received, as recorded for contract assertions. */
export interface RecordedRequest {
    /** When the fake received it, ISO 8601. */
    readonly at: string
    /** The HTTP method, or the SMTP command verb. */
    readonly method: string
    /** The HTTP path with its query, or the SMTP command argument. */
    readonly path: string
    /** The request headers, lower-case names (HTTP only). */
    readonly headers: Readonly<Record<string, string>>
    /** The raw request body (HTTP only). */
    readonly body: string
}

/** One message the SMTP fake accepted, decoded. */
export interface SentMail {
    /** When the message was accepted, ISO 8601. */
    readonly at: string
    /** The envelope sender. */
    readonly from: string
    /** The envelope recipient. */
    readonly to: string
    /** The decoded subject. */
    readonly subject: string
    /** The decoded body. */
    readonly body: string
}

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

/** One webhook the SePay fake delivered to the app and what the app answered. */
export interface WebhookDelivery {
    /** The transaction the delivery reports. */
    readonly gatewayIntentId: string
    /** Whether the delivery carried the right or a wrong secret. */
    readonly signature: "valid" | "invalid"
    /** The HTTP status the app answered. */
    readonly httpStatus: number
    /** The parsed body the app answered. */
    readonly body: unknown
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

/** What the control channel needs to deliver a webhook: where the app listens. */
export interface WebhookTarget {
    /** The base URL of the api the webhook is delivered to. */
    readonly deliverTo: string
}

/** The names of the fakes that record requests and take failures: external SaaS and hosts the stack does not run. */
export type FakeName = "smtp" | "sepay"
