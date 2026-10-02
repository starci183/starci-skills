import { sql } from "@modules/platform/database"

/** Reads one public.resources row by id through a branded SQL statement. */
export const FIND_RESOURCES = sql`SELECT id FROM public.resources WHERE id = $1 LIMIT 1`
