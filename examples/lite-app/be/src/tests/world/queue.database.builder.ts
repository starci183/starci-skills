import assert from "node:assert/strict"
import { DataSource } from "typeorm"
import type { EntityManager } from "typeorm"
import { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"

/** The disposable local migration-owner connection: cron registration and cleanup need owner privileges. */
export const createQueueDatabaseWorld = () => {
    let source: DataSource | undefined

    return {
        async open(): Promise<void> {
            const config = parsePrimaryDatabaseConfig(EnvSource.fromProcess())
            const url = config.url.reveal()
            const host = new URL(url).hostname
            assert(
                ["localhost", "127.0.0.1", "[::1]"].includes(host),
                "Queue proofs require a disposable local Supabase CLI database",
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

        get isOpen(): boolean {
            return source?.isInitialized ?? false
        },

        get manager(): EntityManager {
            assert(source?.isInitialized, "the configured local Supabase connection must be initialized")
            return source.manager
        },

        async close(): Promise<void> {
            if (source?.isInitialized) await source.destroy()
        },
    }
}
