// Imports the host resolves (a comment, because this folder is a shape and not a compiled app):
//   import { sql } from "@modules/platform/database"

/** A job a worker claimed: the token it must pass to every write. */
export interface ClaimedJob {
    readonly jobId: string
    readonly kind: string
    readonly fencingToken: number
    readonly currentStep: string | null
    readonly payload: object
}

/** The target of one guarded write: the job and the token the writer holds. Required in the type, never optional. */
export interface GuardedWrite {
    readonly jobId: string
    readonly expectedFencingToken: number
}

/** The idempotency key of an external effect: only `JobClaims.runKey` makes one. */
export type RunKey = string & { readonly __runKey: unique symbol }

/** The one door to the job row; `platform/jobs` implements it and nothing else writes the table. */
export interface JobClaims {
    claim(params: { kind: string; jobKey: string; payload: object; workerId: string; leaseMs: number }): Promise<ClaimedJob | null>
    advance(write: GuardedWrite & { step: string }): Promise<void>
    complete(write: GuardedWrite): Promise<void>
    fail(write: GuardedWrite & { reason: string }): Promise<void>
    runKey(job: ClaimedJob, step: string): RunKey
}

/** The claim is one atomic upsert keyed by the delivery: the store bumps the token, the worker never reads and writes it back. */
export const CLAIM_JOB = sql`INSERT INTO jobs (kind, job_key, status, fencing_token, claimed_by, lease_expires_at, payload, created_at, updated_at)
    VALUES ($1, $2, 'running', 1, $3, $4, $5::jsonb, $6, $6)
    ON CONFLICT (job_key) DO UPDATE
       SET fencing_token = jobs.fencing_token + 1, claimed_by = $3, lease_expires_at = $4, status = 'running', updated_at = $6
     WHERE jobs.status = 'failed' OR (jobs.status = 'running' AND jobs.lease_expires_at < $6)
    RETURNING id, kind, fencing_token, current_step, payload`

/** A guarded write updates only when the token still matches; no row back means a newer worker owns the job (`JobFencedOut`). */
export const ADVANCE_JOB = sql`UPDATE jobs SET current_step = $3, updated_at = $4
    WHERE id = $1 AND fencing_token = $2 AND status = 'running' RETURNING id`
