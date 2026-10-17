import { sql } from "@modules/platform/database"

/** Reads a job's fenced progress by its delivery key. */
export const READ_JOB = sql`SELECT id, status, fencing_token::text, current_step, error
    FROM public.jobs WHERE job_key = $1 LIMIT 1`
