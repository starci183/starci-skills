import { sql } from "@modules/platform/database"

/** Removes the deduplication claim created by the real inbox module for this proof's delivery ($1). */
export const DELETE_CALENDAR_CLAIM = sql`DELETE FROM public.inbox WHERE source = 'webhook.calendar' AND event_id = $1`
