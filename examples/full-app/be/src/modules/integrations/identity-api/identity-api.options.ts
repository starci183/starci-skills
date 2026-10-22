/** Options of the identity api integration. */
export interface IdentityApiOptions {
    /** The base URL of the identity service. */
    readonly url: string
    /** How long a call waits for the answer. */
    readonly timeoutMs: number
}
