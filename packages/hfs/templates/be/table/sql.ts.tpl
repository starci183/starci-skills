import { sql } from "@modules/platform/database"

/** Reads one public.{{table}} row by id through a branded SQL statement. */
export const FIND_{{upper}} = sql`SELECT id FROM public.{{table}} WHERE id = $1 LIMIT 1`
