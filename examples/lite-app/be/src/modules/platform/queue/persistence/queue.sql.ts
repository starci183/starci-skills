import { sql } from "@modules/platform/database"

/** Writes one job in the outbox, already sent: the pgmq send runs in the same transaction ($1 queue, $2 payload, $3 instant). */
export const INSERT_QUEUE_ROW = sql`INSERT INTO public.queue (queue, payload, created_at, sent_at)
    VALUES ($1, $2::jsonb, $3, $3)
    RETURNING id, queue, payload`

/** Locks and reads the oldest rows that wait ($1 batch size); a second relay skips the rows this one holds. */
export const SELECT_WAITING_ROWS = sql`SELECT id, queue, payload FROM public.queue
    WHERE sent_at IS NULL ORDER BY created_at, id LIMIT $1 FOR UPDATE SKIP LOCKED`

/** Marks the rows as sent to pgmq ($1 ids, $2 instant). */
export const MARK_ROWS_SENT = sql`UPDATE public.queue SET sent_at = $2 WHERE id = ANY($1::uuid[])`

/** Sends one message to a pgmq queue on the connection of the caller's transaction ($1 queue, $2 message). */
export const PGMQ_SEND = sql`SELECT pgmq.send($1, $2::jsonb) AS msg_id`

/** Reads at most $3 messages of the queue $1 and hides them from other readers for $2 seconds (the visibility timeout). */
export const PGMQ_READ = sql`SELECT msg_id, read_ct, message FROM pgmq.read($1, $2, $3) LIMIT $3`

/** Moves a handled message to the archive of its queue ($1 queue, $2 message id). */
export const PGMQ_ARCHIVE = sql`SELECT pgmq.archive($1, $2::bigint) AS archived`

/** Makes a failed message visible again after $3 seconds: the backoff of its next attempt ($1 queue, $2 message id). */
export const PGMQ_SET_VT = sql`SELECT msg_id FROM pgmq.set_vt($1, $2::bigint, $3) LIMIT 1`

/** Creates or replaces the pg_cron job $1 that sends the message $4 to the queue $3 on the schedule $2. */
export const CRON_SCHEDULE = sql`SELECT cron.schedule($1, $2, format('SELECT pgmq.send(%L, %L::jsonb)', $3::text, $4::text)) AS job_id`
