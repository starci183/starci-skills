import type { Secret } from "@modules/platform/config"

/** Options of the SePay integration. */
export interface SepayOptions {
    /** The base URL of the SePay API. */
    readonly baseUrl: string
    /** The credential the API calls carry. */
    readonly apiKey: Secret
    /** The shared secret SePay carries in the Authorization header of a webhook delivery. */
    readonly webhookSecret: Secret
    /** How long a call waits for the gateway before it fails as a timeout. */
    readonly timeoutMs: number
}
