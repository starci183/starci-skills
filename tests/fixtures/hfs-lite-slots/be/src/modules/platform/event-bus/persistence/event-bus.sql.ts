import { sql } from "@modules/platform/database"

/** The publisher writes only through its caller's transaction. */
export const INSERT_OUTBOX_EVENT = sql`INSERT INTO public.event_bus (event_id, event_name, payload)
VALUES ($1, $2, $3::jsonb) ON CONFLICT (event_id) DO NOTHING`

/** Locks committed rows while sends and removal commit in one database transaction. */
export const READ_OUTBOX_EVENTS = sql`SELECT event_id, event_name, payload FROM public.event_bus
ORDER BY event_id FOR UPDATE SKIP LOCKED LIMIT 20`
export const DELETE_OUTBOX_EVENT = sql`DELETE FROM public.event_bus WHERE event_id = $1`
export const SEND_EVENT = sql`SELECT pgmq.send($1::text, $2::jsonb)`
export const READ_EVENTS = sql`SELECT msg_id, read_ct, message FROM pgmq.read($1::text, $2::integer, 10)`
export const DELETE_EVENT = sql`SELECT pgmq.delete($1::text, $2::bigint)`
export const ARCHIVE_EVENT = sql`SELECT pgmq.archive($1::text, $2::bigint)`
