/** An envelope published by a producer or scheduler. */
export interface InspectedQueueMessage {
    /** Outbox identity; scheduler ticks omit it. */
    readonly jobId?: string
    /** The producer's JSON object payload. */
    readonly payload: Record<string, unknown>
}
/** A delivery observed through the queue transport door. */
export interface InspectedQueueRow {
    /** Transport message identity. */
    readonly msg_id: string
    /** The producer or scheduler envelope. */
    readonly message: InspectedQueueMessage
}
/** Selects this proof's deliveries for cleanup. */
export type QueueMessageMatch = (message: InspectedQueueRow) => boolean
