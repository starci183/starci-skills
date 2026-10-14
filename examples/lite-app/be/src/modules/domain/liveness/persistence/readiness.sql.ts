import { sql } from "@modules/platform/database"

/** The primary database answers at all. */
export const CHECK_READINESS_DATABASE = sql`SELECT 1 AS ready LIMIT 1`

/** The queue and job ledgers aggregate: the queues and fenced jobs of the app are reachable through their definer read. */
export const CHECK_READINESS_JOBS = sql`SELECT public.job_stats() AS stats LIMIT 1`
