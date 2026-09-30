import { readFileSync } from "node:fs"
import { join } from "node:path"
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { Client } from "pg"
import { EnvSource } from "@modules/platform/config"
import { bootstrap } from "../../../apps/migrate/src/main"

/** The key under which the setup hands its containers to the teardown. */
export const CONTAINERS_KEY = "ecommerce.e2e.containers"

const SEEDS = join(__dirname, "..", "..", "..", ".starcistacks", "dev", "seeds")

const applySeed = async (url: string, file: string): Promise<void> => {
    const client = new Client({ connectionString: url })
    await client.connect()
    try {
        await client.query(readFileSync(join(SEEDS, file), "utf8"))
    } finally {
        await client.end()
    }
}

/**
 * Jest global setup of the test world: one Postgres container per connection (identity, order), the real `apps/migrate`
 * bootstrap run once against both, the dev seeds applied, and the URLs published for `useTestWorld`.
 */
export default async function globalSetup(): Promise<void> {
    const identity: StartedPostgreSqlContainer = await new PostgreSqlContainer("postgres:16").start()
    const order: StartedPostgreSqlContainer = await new PostgreSqlContainer("postgres:16").start()
    Reflect.set(globalThis, CONTAINERS_KEY, [identity, order])
    const identityUrl = identity.getConnectionUri()
    const orderUrl = order.getConnectionUri()
    await bootstrap(new EnvSource({ IDENTITY_DB_URL: identityUrl, ORDER_DB_URL: orderUrl }))
    await applySeed(identityUrl, "identity-demo.sql")
    await applySeed(orderUrl, "order-catalog.sql")
    process.env.TEST_WORLD_IDENTITY_DB_URL = identityUrl
    process.env.TEST_WORLD_ORDER_DB_URL = orderUrl
}
