import { sql } from "@modules/platform/database"

/** The unique source and delivery id let only one transaction record or process each delivery. */
export const CLAIM_EVENT = sql`INSERT INTO public.inbox (source, event_id)
VALUES ($1, $2)
ON CONFLICT (source, event_id) DO NOTHING
RETURNING event_id`
