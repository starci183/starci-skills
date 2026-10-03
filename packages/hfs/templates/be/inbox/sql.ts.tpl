import { sql } from "@modules/platform/database"

/** Claims one @@provider@@ delivery and returns its durable inbox identity only to the winning transaction. */
export const INSERT_@@providerUpper@@_INBOX = sql`INSERT INTO public.@@table@@ (provider, delivery_id, payload)
VALUES ($1, $2, $3::jsonb)
ON CONFLICT (provider, delivery_id) DO NOTHING
RETURNING id`

/** Marks the claimed delivery complete before the same transaction commits. */
export const COMPLETE_@@providerUpper@@_INBOX = sql`WITH completed AS (
    UPDATE public.@@table@@
    SET processed_at = now()
    WHERE id = $1
    RETURNING id
)
SELECT id FROM completed`
