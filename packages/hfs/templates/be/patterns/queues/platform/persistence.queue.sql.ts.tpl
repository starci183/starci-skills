import { sql } from "@modules/platform/database"

/** Writes one job in the outbox ($1 queue, $2 payload, $3 instant). */
export const INSERT_QUEUE_ROW = sql`INSERT INTO queue_outbox (queue, payload, created_at)
    VALUES ($1, $2, $3)`

/** Locks and reads the oldest rows that wait ($1 batch size); a second relay skips the rows this one holds. */
export const SELECT_WAITING_ROWS = sql`SELECT id, queue, payload FROM queue_outbox
    WHERE sent_at IS NULL ORDER BY created_at, id LIMIT $1 FOR UPDATE SKIP LOCKED`

/** Marks the rows as handed to BullMQ ($1 ids, $2 instant). */
export const MARK_ROWS_SENT = sql`UPDATE queue_outbox SET sent_at = $2 WHERE id = ANY($1::uuid[])`
