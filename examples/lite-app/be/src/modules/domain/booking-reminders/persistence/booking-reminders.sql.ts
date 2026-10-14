import { sql } from "@modules/platform/database"

/** Sends one reminder tick atomically through the app-owned pgmq door ($1 queue, $2 message envelope). */
export const ENQUEUE_REMINDER_TICK = sql`SELECT private.queue_send($1, $2::jsonb) AS msg_id LIMIT 1`
