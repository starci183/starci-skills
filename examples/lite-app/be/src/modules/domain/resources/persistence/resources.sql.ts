import { sql } from "@modules/platform/database"

/** Reads one public.resources row by id and owner through a branded SQL statement. */
export const FIND_RESOURCES = sql`SELECT id FROM public.resources WHERE id = $1 AND owner_id = $2 LIMIT 1`
