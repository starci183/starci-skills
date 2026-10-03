import { sql } from "@modules/platform/database"

/** Reads one public.calendars row by id and owner through a branded SQL statement. */
export const FIND_CALENDARS = sql`SELECT id FROM public.calendars WHERE id = $1 AND owner_id = $2 LIMIT 1`

/** Resolves the calendar referenced by a verified provider delivery. */
export const FIND_DELIVERY_CALENDAR = sql`SELECT id FROM public.calendars WHERE id = $1 LIMIT 1`
