import assert from "node:assert/strict"
import { DataSource } from "typeorm"
import type { EntityManager } from "typeorm"
import { EnvSource } from "@modules/platform/config"
import { readCliEnv } from "../../../../apps/cli/src/cli.env"

/** The disposable local migration-owner connection: cron registration and cleanup need owner privileges. */
export class QueueDatabaseFixture {
    private source: DataSource | undefined

    async open(): Promise<void> {
        const config = readCliEnv(EnvSource.fromProcess())
        const url = config.url.reveal()
        const host = new URL(url).hostname
        assert(
            ["localhost", "127.0.0.1", "[::1]"].includes(host),
            "Queue proofs require a disposable local Supabase CLI database",
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

    get isOpen(): boolean {
        return this.source?.isInitialized ?? false
    }

    get manager(): EntityManager {
        assert(this.source?.isInitialized, "the configured local Supabase connection must be initialized")
        return this.source.manager
    }

    async close(): Promise<void> {
        if (this.source?.isInitialized) await this.source.destroy()
    }
}
