import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { DataSource } from "typeorm"
import type { EntityManager, QueryRunner } from "typeorm"
import { EnvSource } from "@modules/platform/config"
import { sql } from "@modules/platform/database"
import { readCliEnv } from "../../../apps/cli/src/cli.env"

interface JobSnapshot {
    readonly id: string
    readonly status: string
    readonly fencing_token: string
    readonly current_step: string | null
    readonly error: string | null
}

const READ_JOB = sql`SELECT id, status, fencing_token::text, current_step, error
    FROM public.jobs WHERE job_key = $1`

/** Opens the configured Supabase connection and rolls each proof's real job writes back under the app_be role. */
export class JobsDatabaseFixture {
    private source: DataSource | undefined
    private scope: QueryRunner | undefined
    private readonly prefix = `lite-fenced-proof-${randomUUID()}-`

    async open(): Promise<void> {
        const config = readCliEnv(EnvSource.fromProcess())
        const url = config.url.reveal()
        assert(
            ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname),
            "Fenced job proofs require a local Supabase CLI database",
        )
        this.source = new DataSource({
            type: "postgres",
            name: config.name,
            url,
            schema: config.schema,
            synchronize: false,
            connectTimeoutMS: 5_000,
        })
        await this.source.initialize()
    }

    get manager(): EntityManager {
        assert(this.scope?.isTransactionActive, "the proof must have an active database transaction")
        return this.scope.manager
    }

    async begin(): Promise<void> {
        assert(this.source?.isInitialized, "the configured local Supabase connection must be initialized")
        this.scope = this.source.createQueryRunner()
        await this.scope.connect()
        await this.scope.startTransaction()
    }

    async rollback(): Promise<void> {
        const scope = this.scope
        this.scope = undefined
        if (scope === undefined) return
        try {
            if (scope.isTransactionActive) await scope.rollbackTransaction()
        } finally {
            await scope.release()
        }
    }

    key(scenario: string): string {
        return `${this.prefix}${scenario}`
    }

    async snapshot(key: string): Promise<JobSnapshot | undefined> {
        const rows = await this.manager.query<Array<JobSnapshot>>(READ_JOB, [key])
        return rows[0]
    }

    async close(): Promise<void> {
        if (!this.source?.isInitialized) return
        try {
            await this.rollback()
        } finally {
            await this.source.destroy()
        }
    }
}
