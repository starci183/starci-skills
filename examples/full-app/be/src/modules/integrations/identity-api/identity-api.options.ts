import type { Secret } from "@modules/platform/config"

/** Options of the identity api integration. */
export interface IdentityApiOptions {
    /** The base URL of the identity service. */
    readonly url: string
    /** How long a call waits for the answer. */
    readonly timeoutMs: number
    /** This service's own key, presented to the identity service's service doors. */
    readonly serviceKey: Secret
}
