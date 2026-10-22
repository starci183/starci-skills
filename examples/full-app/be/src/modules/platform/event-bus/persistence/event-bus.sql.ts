import { sql } from "@modules/platform/database"

/** Writes one event in the outbox ($1 event id, $2 event name, $3 topic, $4 key, $5 envelope, $6 instant). */
export const INSERT_OUTBOX_ROW = sql`INSERT INTO event_outbox (event_id, event_name, topic, message_key, envelope, created_at)
    VALUES ($1, $2, $3, $4, $5, $6)`

/** Locks and reads the oldest rows that wait ($1 batch size); a second relay skips the rows this one holds. */
export const SELECT_WAITING_ROWS = sql`SELECT id, topic, message_key, envelope FROM event_outbox
    WHERE sent_at IS NULL ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED`

/** Marks the rows as handed to the broker ($1 ids, $2 instant). */
export const MARK_ROWS_SENT = sql`UPDATE event_outbox SET sent_at = $2 WHERE id = ANY($1::bigint[])`
