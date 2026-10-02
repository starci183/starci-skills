import { sql } from "@modules/platform/database"

/** Reads one public.bookings row by id through a branded SQL statement. */
export const FIND_BOOKINGS = sql`SELECT id FROM public.bookings WHERE id = $1 LIMIT 1`
