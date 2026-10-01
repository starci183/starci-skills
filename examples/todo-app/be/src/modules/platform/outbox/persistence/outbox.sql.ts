import { sql } from "@modules/platform/database"

/** Writes one message ($1 id, $2 queue, $3 event id, $4 payload, $5 available at, $6 created at); the same (queue, event id) twice keeps the first. */
export const INSERT_MESSAGE = sql`INSERT INTO outbox_messages (id, queue, event_id, payload, available_at, attempts, status, created_at)
    VALUES ($1, $2, $3, $4, $5, 0, 'pending', $6) ON CONFLICT (queue, event_id) DO NOTHING`

/**
 * Claims up to $3 pending messages of the queues $2 that are due at $1: each claim counts an attempt and hides the
 * message until $4, and two workers never claim the same row (SKIP LOCKED).
 */
export const CLAIM_DUE_MESSAGES = sql`UPDATE outbox_messages SET attempts = attempts + 1, available_at = $4
    WHERE id IN (
        SELECT id FROM outbox_messages WHERE status = 'pending' AND available_at <= $1 AND queue = ANY($2)
        ORDER BY available_at LIMIT $3 FOR UPDATE SKIP LOCKED
    )
    RETURNING id, queue, event_id, payload, attempts`

/** Marks the message $1 as delivered. */
export const COMPLETE_MESSAGE = sql`UPDATE outbox_messages SET status = 'done', last_error = NULL WHERE id = $1`

/** Schedules the next delivery of the message $1 at $2 and keeps the failure $3. */
export const RETRY_MESSAGE = sql`UPDATE outbox_messages SET available_at = $2, last_error = $3 WHERE id = $1`

/** Marks the message $1 as dead and keeps the failure $2. */
export const BURY_MESSAGE = sql`UPDATE outbox_messages SET status = 'dead', last_error = $2 WHERE id = $1`
