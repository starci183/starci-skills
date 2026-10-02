import { sql } from "@modules/platform/database"

/** Sums the points of every ledger entry of one person ($1); answers one row, zero when the person has no entry. */
export const SUM_PERSON_POINTS = sql`SELECT COALESCE(SUM(points), 0)::int AS points FROM loyalty_entries WHERE person_id = $1`
