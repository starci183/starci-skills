import { sql } from "@modules/platform/database"

/** Reads one public.calendars row by id through a branded SQL statement. */
export const FIND_CALENDARS = sql`SELECT id FROM public.calendars WHERE id = $1 LIMIT 1`
