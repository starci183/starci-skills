import assert from "node:assert/strict"
import { DataSource } from "typeorm"
import type { EntityManager, QueryRunner } from "typeorm"
import { reapplyBookingSchedule } from "./migration-owner.client"
import { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"

/** The `schema` option of a connection, left out when the connection names none. */
const schemaOption = (schema: string | undefined): Partial<Record<"schema", string>> =>
    schema === undefined ? {} : { schema }

/** The database connections shared by every lite integration collaboration. */
export interface TestDatabases {
    readonly primary: EntityManager
    /** Local CLI migration owner, used only for scheduler proofs and fixture cleanup. */
    readonly owner: EntityManager
    /** Reapplies the top-level local migration declaration through the migration driver. */
    readonly reapplyBookingSchedule: () => Promise<Array<{ jobid: string }>>
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

/** Supabase CLI's disposable local database uses public fixture credentials. */
const createLocalOwnerConnection = (url: string) => {
    const ownerUrl = new URL(url)
    ownerUrl.username = "postgres"
    ownerUrl.password = "postgres"
    return {
        source: new DataSource({ type: "postgres", url: ownerUrl.href, synchronize: false, connectTimeoutMS: 5_000 }),
    }
}

/** Connects to the already migrated local CLI stack without changing its schema. */
export const useTestWorld = <T>(options: TestWorldOptions<T>): TestWorld<T> => {
    let source: DataSource | undefined
    let owner: DataSource | undefined
    let scope: QueryRunner | undefined
    let modules: T | undefined
    const db: TestDatabases = {
        reapplyBookingSchedule: () => {
            assert(owner?.isInitialized, "the local migration-owner connection must be initialized")
            return reapplyBookingSchedule()
        },
        get owner() {
            assert(owner?.isInitialized, "the local migration-owner connection must be initialized")
            return owner.manager
        },
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
        assert(new URL(url).username === "app_be", "Application proofs must use the least-privilege app_be role")
        source = new DataSource({
            type: "postgres",
            name: config.name,
            url,
            ...schemaOption(config.schema),
            synchronize: false,
            connectTimeoutMS: 5_000,
        })
        await source.initialize()
        const localOwner = createLocalOwnerConnection(url)
        owner = localOwner.source
        await owner.initialize()
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
            try {
                if (owner?.isInitialized) await owner.destroy()
            } finally {
                if (source?.isInitialized) await source.destroy()
            }
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
