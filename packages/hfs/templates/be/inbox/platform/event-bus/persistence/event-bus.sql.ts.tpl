import { sql } from "@modules/platform/database"

/** Writes only the typed envelope; a reactor or job reads the committed row afterward. */
export const INSERT_OUTBOX_EVENT = sql`INSERT INTO public.event_bus (event_id, event_name, payload)
VALUES ($1, $2, $3::jsonb)`
