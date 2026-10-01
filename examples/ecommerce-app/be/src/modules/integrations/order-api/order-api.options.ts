/** Options of the order api integration. */
export interface OrderApiOptions {
    /** The base URL of the order service. */
    readonly url: string
    /** How long a call waits for the answer. */
    readonly timeoutMs: number
}
