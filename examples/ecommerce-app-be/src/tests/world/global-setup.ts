/**
 * The jest globalSetup of the test world (default export, Jest API): starts the shared infrastructure ONCE for the run and
 * hands its coordinates to the spec workers through a state file.
 *  1. the stack of the repository (`.starcistacks/dev`) through `hfs test-stack up`: every service it declares (Postgres,
 *     Redis) runs for real behind toxiproxy; a warm stack (`npm run test:stack -- up`) that already answers is attached to,
 *     else this run starts its own and stops it again;
 *  2. one database per connection (identity, order) inside the stack's Postgres, named by the run, and the run's own
 *     Redis database, emptied;
 *  3. `apps/migrate` `bootstrap(env)` once against both databases: the only place that creates a schema;
 *  4. the dev seeds of `.starcistacks/dev/seeds`.
 * Nothing external is faked: this product calls no third-party SaaS. A failure removes whatever this run started before it is
 * rethrown: jest does not call the teardown after a failed setup.
 */
import "tsconfig-paths/register"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Client } from "pg"
import { runToken } from "@tests/world/kit/run-tokens"
import { EnvSource } from "@modules/platform/config"
import { bootstrap } from "../../../apps/migrate/src/main"
import { cacheUrlOf, flushCache } from "./cache.client"
import { createDatabase, databaseUrlOf, dropDatabase } from "./database.client"
import { startStack, stopStack } from "./stack.client"
import type { TestStack } from "./stack.client"
import { writeWorldState } from "./test-world-state.service"
import type { TestDatabaseState } from "./test-world-state.service"

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

const startDatabase = async (stack: TestStack, runId: string, connection: string): Promise<TestDatabaseState> => {
    const database = `ecommerce_${connection}_${runId}`
    await createDatabase(stack, database)
    return { database, url: databaseUrlOf(stack, database, true), directUrl: databaseUrlOf(stack, database, false) }
}

/** Starts the shared infrastructure of the run and publishes its coordinates. */
export default async function globalSetup(): Promise<void> {
    const runId = runToken(4)
    const stack = startStack()
    const created: Array<string> = []
    try {
        const identity = await startDatabase(stack, runId, "identity")
        created.push(identity.database)
        const order = await startDatabase(stack, runId, "order")
        created.push(order.database)
        await flushCache(stack, runId)
        await bootstrap(new EnvSource({ IDENTITY_DB_URL: identity.directUrl, ORDER_DB_URL: order.directUrl }))
        await applySeed(identity.directUrl, "identity-demo.sql")
        await applySeed(order.directUrl, "order-catalog.sql")
        writeWorldState({
            runId,
            ownsStack: stack.started,
            stack,
            identity,
            order,
            cacheUrl: cacheUrlOf(stack, runId, true),
        })
    } catch (error) {
        if (stack.started) stopStack()
        else for (const database of created) await dropDatabase(stack, database)
        throw error
    }
}
