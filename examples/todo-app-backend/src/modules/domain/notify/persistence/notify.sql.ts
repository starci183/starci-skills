import { sql } from "@modules/platform/database"

/**
 * Admits a notification once: $1 id (the dedupe key), $2 kind, $3 recipient, $4 payload as JSON text, $5 created at.
 * An INSERT answers the rows it inserted: one row for a new notification, none when the key was already admitted.
 */
export const INSERT_NOTIFICATION_IF_ABSENT = sql`INSERT INTO notify_notifications (id, kind, recipient_id, payload, digest_group_id, created_at)
    VALUES ($1, $2, $3, $4::jsonb, NULL, $5) ON CONFLICT (id) DO NOTHING RETURNING id`
