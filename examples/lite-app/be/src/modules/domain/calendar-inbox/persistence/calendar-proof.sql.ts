import { sql } from "@modules/platform/database"

/** Reads up to two receipts for a provider delivery ($1 provider, $2 delivery id), so duplicate intake fails. */
export const READ_CALENDAR_RECEIPTS = sql`SELECT id, processed_at FROM public.calendar_inbox WHERE provider = $1 AND delivery_id = $2 LIMIT 2`

/** Reads whether the committed receipt ($1) has been consumed by the deferred processor. */
export const READ_CALENDAR_PROCESSED = sql`SELECT processed_at IS NOT NULL AS processed FROM public.calendar_inbox WHERE id = $1 LIMIT 2`

/** Collects every matching receipt for cleanup after either a successful or failed proof ($1 provider, $2 delivery id). */
export const READ_CALENDAR_RECEIPT_IDS = sql`SELECT coalesce(array_agg(id::text), ARRAY[]::text[]) AS ids FROM public.calendar_inbox WHERE provider = $1 AND delivery_id = $2`

/** Removes only this provider delivery's inbox receipts ($1 provider, $2 delivery id). */
export const DELETE_CALENDAR_RECEIPTS = sql`DELETE FROM public.calendar_inbox WHERE provider = $1 AND delivery_id = $2`
