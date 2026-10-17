import { sql } from "@modules/platform/database"

/** Finds at most two outbox rows for a queue and booking ($1 queue, $2 booking id), enough to detect duplicate publication. */
export const READ_BOOKING_OUTBOX = sql`SELECT id, payload, sent_at FROM public.queue WHERE queue = $1 AND payload->>'bookingId' = $2 LIMIT 2`

/** Finds at most two pgmq messages for the booking ($1), including messages invisible outside its transaction. */
export const READ_BOOKING_MESSAGES = sql`SELECT msg_id, message FROM pgmq.q_booking_reminder WHERE message->'payload'->>'bookingId' = $1 LIMIT 2`

/** Arranges an unsent SQL-side outbox row for the relay proof ($1 queue, $2 JSON payload). */
export const INSERT_PENDING_BOOKING = sql`INSERT INTO public.queue (queue, payload, created_at) VALUES ($1, $2::jsonb, now()) RETURNING id`

/** Reads the migration's named scheduler registration ($1), including its expression and command. */
export const READ_BOOKING_SCHEDULE = sql`SELECT jobid, schedule, command FROM cron.job WHERE jobname = $1 LIMIT 2`

/** Registers the same named cron job again ($1 name, $2 expression, $3 command) to prove idempotence. */
export const REGISTER_BOOKING_SCHEDULE = sql`SELECT cron.schedule($1, $2, $3) AS jobid`

/** Reads up to two scheduler identities for a name ($1), so duplicate registrations fail the proof. */
export const READ_BOOKING_SCHEDULE_ID = sql`SELECT jobid FROM cron.job WHERE jobname = $1 LIMIT 2`

/** Counts every scheduler tick message before and after invoking the migrated tick function. */
export const COUNT_BOOKING_TICKS = sql`SELECT count(*) FROM pgmq.q_booking_reminder WHERE message->'payload'->>'tick' = 'true'`

/** Invokes the fixed migration-owned command after the proof verifies the stored scheduler command. */
export const RUN_BOOKING_TICK = sql`select private.booking_reminder_tick()`

/** Removes only the booking proof's pgmq messages ($1 booking ids). */
export const DELETE_BOOKING_MESSAGES = sql`DELETE FROM pgmq.q_booking_reminder WHERE message->'payload'->>'bookingId' = ANY($1::text[])`

/** Removes only the booking proof's committed outbox rows ($1 booking ids). */
export const DELETE_BOOKING_OUTBOX = sql`DELETE FROM public.queue WHERE payload->>'bookingId' = ANY($1::text[])`

/** Reads up to two receipts for a provider delivery ($1 provider, $2 delivery id), so duplicate intake fails. */
export const READ_CALENDAR_RECEIPTS = sql`SELECT id, processed_at FROM public.calendar_inbox WHERE provider = $1 AND delivery_id = $2 LIMIT 2`

/** Finds up to two jobs referencing the committed receipts ($1 queue, $2 receipt ids). */
export const READ_CALENDAR_JOBS = sql`SELECT id, payload FROM public.queue WHERE queue = $1 AND payload->>'receiptId' = ANY($2::text[]) LIMIT 2`

/** Reads up to two pgmq envelopes for an outbox identity ($1), so duplicate publication fails. */
export const READ_CALENDAR_MESSAGES = sql`SELECT message FROM pgmq.q_calendar_delivery WHERE message->>'jobId' = $1 LIMIT 2`

/** Reads whether the committed receipt ($1) has been consumed by the deferred processor. */
export const READ_CALENDAR_PROCESSED = sql`SELECT processed_at IS NOT NULL AS processed FROM public.calendar_inbox WHERE id = $1 LIMIT 2`

/** Collects every matching receipt for cleanup after either a successful or failed proof ($1 provider, $2 delivery id). */
export const READ_CALENDAR_RECEIPT_IDS = sql`SELECT coalesce(array_agg(id::text), ARRAY[]::text[]) AS ids FROM public.calendar_inbox WHERE provider = $1 AND delivery_id = $2`

/** Removes pgmq messages that reference this proof's receipts ($1 receipt ids). */
export const DELETE_CALENDAR_MESSAGES = sql`DELETE FROM pgmq.q_calendar_delivery WHERE message->'payload'->>'receiptId' = ANY($1::text[])`

/** Removes only the matching calendar outbox jobs ($1 queue, $2 receipt ids). */
export const DELETE_CALENDAR_OUTBOX = sql`DELETE FROM public.queue WHERE queue = $1 AND payload->>'receiptId' = ANY($2::text[])`

/** Removes only this provider delivery's inbox receipts ($1 provider, $2 delivery id). */
export const DELETE_CALENDAR_RECEIPTS = sql`DELETE FROM public.calendar_inbox WHERE provider = $1 AND delivery_id = $2`

/** Removes the deduplication claim created by the real inbox module for this proof's delivery ($1). */
export const DELETE_CALENDAR_CLAIM = sql`DELETE FROM public.inbox WHERE source = 'webhook.calendar' AND event_id = $1`
