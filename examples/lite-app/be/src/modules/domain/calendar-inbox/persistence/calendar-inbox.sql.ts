import { sql } from "@modules/platform/database"

/** Claims one calendar delivery and returns its durable inbox identity only to the winning transaction. */
export const INSERT_CALENDAR_INBOX = sql`INSERT INTO public.calendar_inbox (provider, delivery_id, payload)
VALUES ($1, $2, $3::jsonb)
ON CONFLICT (provider, delivery_id) DO NOTHING
RETURNING id`

/** Locks a committed pending receipt while its deferred consumer processes it. */
export const FIND_PENDING_CALENDAR_INBOX = sql`SELECT id, payload FROM public.calendar_inbox
WHERE id = $1 AND processed_at IS NULL
FOR UPDATE`

/** Marks the receipt complete in the deferred consumer's transaction. */
export const COMPLETE_CALENDAR_INBOX = sql`WITH completed AS (
    UPDATE public.calendar_inbox
    SET processed_at = now()
    WHERE id = $1 AND processed_at IS NULL
    RETURNING id
)
SELECT id FROM completed`
