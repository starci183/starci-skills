import { sql } from "@modules/platform/database"

/** Finds at most two outbox rows for a queue and booking ($1 queue, $2 booking id), enough to detect duplicate publication. */
export const READ_BOOKING_OUTBOX = sql`SELECT id, payload, sent_at FROM public.queue WHERE queue = $1 AND payload->>'bookingId' = $2 LIMIT 2`

/** Arranges an unsent SQL-side outbox row for the relay proof ($1 queue, $2 JSON payload). */
export const INSERT_PENDING_BOOKING = sql`INSERT INTO public.queue (queue, payload, created_at) VALUES ($1, $2::jsonb, now()) RETURNING id`

/** Removes only the booking proof's committed outbox rows ($1 booking ids). */
export const DELETE_BOOKING_OUTBOX = sql`DELETE FROM public.queue WHERE payload->>'bookingId' = ANY($1::text[])`

/** Finds up to two jobs referencing the committed receipts ($1 queue, $2 receipt ids). */
export const READ_CALENDAR_JOBS = sql`SELECT id, payload FROM public.queue WHERE queue = $1 AND payload->>'receiptId' = ANY($2::text[]) LIMIT 2`

/** Removes only the matching calendar outbox jobs ($1 queue, $2 receipt ids). */
export const DELETE_CALENDAR_OUTBOX = sql`DELETE FROM public.queue WHERE queue = $1 AND payload->>'receiptId' = ANY($2::text[])`
