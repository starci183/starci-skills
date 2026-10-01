import type { OutboxRecord } from "../outbox.contracts"

/** The row CLAIM_DUE_MESSAGES answers. */
export interface ClaimedMessageRow {
    /** The row id. */
    id: string
    /** The queue name. */
    queue: string
    /** The stable event id. */
    event_id: string
    /** The stored JSON payload. */
    payload: unknown
    /** How many deliveries were started. */
    attempts: number
}

/** Maps a claimed row to the record a worker delivers. */
export const toOutboxRecord = (row: ClaimedMessageRow): OutboxRecord => ({
    id: row.id,
    queue: row.queue,
    eventId: row.event_id,
    payload: row.payload,
    attempts: row.attempts,
})
