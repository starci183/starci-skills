import { sql } from "@modules/platform/database"

/** Reads one public.bookings row by id and owner through a branded SQL statement. */
export const FIND_BOOKINGS = sql`SELECT id, resource_id, starts_at, ends_at FROM public.bookings WHERE id = $1 AND owner_id = $2 LIMIT 1`
