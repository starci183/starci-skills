import { sql } from "@modules/platform/database"

/** Reads one public.{{table}} row by id and owner through a branded SQL statement. */
export const FIND_{{upper}} = sql`SELECT id FROM public.{{tableSql}} WHERE id = $1 AND owner_id = $2 LIMIT 1`
