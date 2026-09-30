import { sql } from "@modules/platform/database"

/**
 * Takes the lease $1 for holder $2 until $3 when it is free, expired, or already held by $2; the fence grows with every
 * grant. $4 is the request instant. Returns the fence when granted and no row when another live holder has it.
 */
export const ACQUIRE_LEASE = sql`INSERT INTO job_leases (name, holder, fence, expires_at) VALUES ($1, $2, 1, $3)
    ON CONFLICT (name) DO UPDATE SET holder = $2, fence = job_leases.fence + 1, expires_at = $3
    WHERE job_leases.expires_at <= $4 OR job_leases.holder = $2
    RETURNING fence`

/** Lets the lease $1 go when $2 is still the current fence and $3 the holder. */
export const RELEASE_LEASE = sql`DELETE FROM job_leases WHERE name = $1 AND fence = $2 AND holder = $3`
