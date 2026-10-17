import assert from "node:assert/strict"
import { DataSource } from "typeorm"
import type { EntityManager, QueryRunner } from "typeorm"
import { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"

/** The database connections shared by every lite integration collaboration. */
export interface TestDatabases {
    readonly primary: EntityManager
}

/** A capability collaboration initialized against the local Supabase database. */
export interface TestWorld<T> {
    readonly db: TestDatabases
    readonly modules: T
}

/** The capability factory and isolation required by an integration collaboration. */
export interface TestWorldOptions<T> {
    readonly modules: (db: TestDatabases) => T | Promise<T>
    readonly rollback?: boolean
    readonly cleanup?: (modules: T) => Promise<void>
}

/** Connects to the already migrated local CLI stack without changing its schema. */
export const useTestWorld = <T>(options: TestWorldOptions<T>): TestWorld<T> => {
    let source: DataSource | undefined
    let scope: QueryRunner | undefined
    let modules: T | undefined
    const db: TestDatabases = {
        get primary() {
            assert(source?.isInitialized, "the local Supabase connection must be initialized")
            return scope?.manager ?? source.manager
        },
    }
    beforeAll(async () => {
        const config = parsePrimaryDatabaseConfig(EnvSource.fromProcess())
        const url = config.url.reveal()
        assert(
            ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname),
            "Integration proofs require a disposable local Supabase CLI database",
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
        modules = await options.modules(db)
    })
    beforeEach(async () => {
        if (!options.rollback) return
        assert(source?.isInitialized)
        scope = source.createQueryRunner()
        await scope.connect()
        await scope.startTransaction()
    })
    afterEach(async () => {
        const active = scope
        scope = undefined
        if (active === undefined) return
        try {
            if (active.isTransactionActive) await active.rollbackTransaction()
        } finally {
            await active.release()
        }
    })
    afterAll(async () => {
        try {
            if (modules !== undefined) await options.cleanup?.(modules)
        } finally {
            if (source?.isInitialized) await source.destroy()
        }
    })
    return {
        db,
        get modules() {
            assert(modules !== undefined, "the world must initialize its capability collaboration")
            return modules
        },
    }
}
