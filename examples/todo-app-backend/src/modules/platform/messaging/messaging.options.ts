/** Options of the messaging capability: how a worker polls the durable store. */
export interface MessagingOptions {
    /** The pause between two polls of the store, in milliseconds. */
    readonly pollMs: number
    /** The most messages one poll claims. */
    readonly batchSize: number
    /** How long a claimed message stays invisible to other workers, in milliseconds. */
    readonly visibilityMs: number
}
