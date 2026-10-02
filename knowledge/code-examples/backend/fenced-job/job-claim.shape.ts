// Imports the host resolves (a comment, because this folder is a shape and not a compiled app):
//   import type { EntityManager } from "typeorm"
//   import { SqlText } from "@modules/platform/database"

/** A job a worker claimed: the token it must pass to every write. */
export interface ClaimedJob {
    readonly jobId: string
    readonly kind: string
    readonly fencingToken: number
    readonly currentStep: string | null
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
    enqueue(tx: EntityManager, params: { kind: string; payload: object }): Promise<string>
    claim(params: { kind: string; workerId: string; leaseMs: number }): Promise<ClaimedJob | null>
    advance(write: GuardedWrite & { step: string }): Promise<void>
    complete(write: GuardedWrite): Promise<void>
    fail(write: GuardedWrite & { reason: string }): Promise<void>
    runKey(job: ClaimedJob, step: string): RunKey
}

/** The claim is one atomic statement: the token is bumped by the store, not read and written back by the worker. */
export const CLAIM_JOB: SqlText = `
    UPDATE jobs
       SET fencing_token = fencing_token + 1, claimed_by = $2, lease_expires_at = $3, status = 'running'
     WHERE id = (SELECT id FROM jobs WHERE kind = $1 AND (status = 'ready' OR lease_expires_at < $4) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING id, kind, fencing_token, current_step
`

/** A guarded write updates only when the token still matches; zero rows means a newer worker owns the job (`JobFencedOut`). */
export const ADVANCE_JOB: SqlText = `
    UPDATE jobs SET current_step = $3 WHERE id = $1 AND fencing_token = $2
`
