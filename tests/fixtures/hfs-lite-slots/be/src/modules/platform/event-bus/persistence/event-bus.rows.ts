import type { EventEnvelope } from "../event-bus.contracts"

/** Supabase migrations, rather than TypeORM entities, own these columns. */
export interface EventOutboxRow {
    readonly event_id: string
    readonly event_name: string
    readonly payload: EventEnvelope
}

/** The pgmq read result includes the visibility-timeout attempt count. */
export interface EventQueueRow {
    readonly msg_id: string
    readonly read_ct: number
    readonly message: EventEnvelope
}
