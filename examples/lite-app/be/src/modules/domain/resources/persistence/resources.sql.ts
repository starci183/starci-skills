import { sql } from "@modules/platform/database"

/** Reads one public.resources row by id and owner through a branded SQL statement. */
export const FIND_RESOURCES = sql`SELECT id FROM public.resources WHERE id = $1 AND owner_id = $2 LIMIT 1`

/** Inserts one public.resources row owned by the principal and returns its id. */
export const INSERT_RESOURCES = sql`INSERT INTO public.resources (owner_id) VALUES ($1) RETURNING id`
