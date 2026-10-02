import type { EntityManager } from "typeorm"
import { sql } from "@modules/platform/database"

/** The source facts of the probe projection: a test-only table the spec creates, standing for the facts of the owning context. */
export const CREATE_PROBE_FACT = sql`CREATE TABLE IF NOT EXISTS probe_fact (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner text NOT NULL, amount integer NOT NULL)`

/** The read model of the probe projection: one row per owner. */
export const CREATE_PROBE_TOTAL = sql`CREATE TABLE IF NOT EXISTS probe_total (owner text PRIMARY KEY, total integer NOT NULL)`

/** Recomputes one owner row from the facts ($1 owner): an upsert by the natural key. */
const RECOMPUTE = sql`INSERT INTO probe_total (owner, total) SELECT $1, COALESCE(SUM(amount), 0) FROM probe_fact WHERE owner = $1
    ON CONFLICT (owner) DO UPDATE SET total = EXCLUDED.total`

/** One owner row ($1 owner). */
const READ = sql`SELECT total FROM probe_total WHERE owner = $1`

/** Every owner of the facts. */
const OWNERS = sql`SELECT DISTINCT owner FROM probe_fact ORDER BY owner LIMIT 1000`

/** The probe read model, shaped as a `<name>.projection.ts`: `recompute*` writes idempotently from the facts, `get*` reads. */
export class ProbeTotalProjection {
    constructor(private readonly entityManager: EntityManager) {}

    /** Recomputes the total of one owner from its facts; repeating it changes nothing. */
    async recomputeProbeTotal(owner: string): Promise<void> {
        await this.entityManager.query(RECOMPUTE, [owner])
    }

    /** Rebuilds every row from the facts: the replay of the projection. */
    async replayProbeTotals(): Promise<void> {
        const owners: Array<{ owner: string }> = await this.entityManager.query(OWNERS)
        for (const { owner } of owners) await this.recomputeProbeTotal(owner)
    }

    /** Reads the total of one owner; null when there is no row. */
    async getProbeTotal(owner: string): Promise<number | null> {
        const rows: Array<{ total: number }> = await this.entityManager.query(READ, [owner])
        return rows[0]?.total ?? null
    }
}
