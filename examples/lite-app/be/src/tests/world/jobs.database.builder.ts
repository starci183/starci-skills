import assert from "node:assert/strict"
import type { FakeIds } from "@starci/jest-preset"
import { DataSource } from "typeorm"
import type { EntityManager, QueryRunner } from "typeorm"
import { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig, sql } from "@modules/platform/database"

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
export const createJobsDatabaseWorld = (ids: Pick<FakeIds, "next">) => {
    let source: DataSource | undefined
    let scope: QueryRunner | undefined
    const prefix = `lite-fenced-proof-${ids.next()}-`

    return {
        async open(): Promise<void> {
            const config = parsePrimaryDatabaseConfig(EnvSource.fromProcess())
            const url = config.url.reveal()
            assert(
                ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname),
                "Fenced job proofs require a local Supabase CLI database",
            )
            source = new DataSource({
                type: "postgres",
                name: config.name,
                url,
                schema: config.schema,
                synchronize: false,
                connectTimeoutMS: 5_000,
            })
            await source.initialize()
        },

        get manager(): EntityManager {
            assert(scope?.isTransactionActive, "the proof must have an active database transaction")
            return scope.manager
        },

        async begin(): Promise<void> {
            assert(source?.isInitialized, "the configured local Supabase connection must be initialized")
            scope = source.createQueryRunner()
            await scope.connect()
            await scope.startTransaction()
        },

        async rollback(): Promise<void> {
            const activeScope = scope
            scope = undefined
            if (activeScope === undefined) return
            try {
                if (activeScope.isTransactionActive) await activeScope.rollbackTransaction()
            } finally {
                await activeScope.release()
            }
        },

        key(scenario: string): string {
            return `${prefix}${scenario}`
        },

        async snapshot(key: string): Promise<JobSnapshot | undefined> {
            const rows = await this.manager.query<Array<JobSnapshot>>(READ_JOB, [key])
            return rows[0]
        },

        async close(): Promise<void> {
            if (!source?.isInitialized) return
            try {
                await this.rollback()
            } finally {
                await source.destroy()
            }
        },
    }
}
