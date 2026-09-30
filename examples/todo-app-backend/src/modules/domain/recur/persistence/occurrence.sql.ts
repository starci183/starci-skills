import { sql } from "@modules/platform/database"

/** Orphans the still materialised occurrences of rule $1 dated on or after local date $2; completed and skipped ones stay as they are. */
export const ORPHAN_ENDED_OCCURRENCES = sql`UPDATE occurrences SET status = 'orphaned'
    WHERE rule_id = $1 AND status = 'materialised' AND local_date >= $2`
