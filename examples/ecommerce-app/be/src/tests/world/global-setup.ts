/**
 * The jest globalSetup of the test world (default export, Jest API): starts the shared infrastructure ONCE for the run and
 * hands its coordinates to the spec workers through a state file.
 *  1. one Postgres container per connection (identity, order) through `docker run`, named by the run, published on a
 *     loopback port the OS allocated;
 *  2. `apps/migrate` `bootstrap(env)` once against both: the only place that creates a schema;
 *  3. the dev seeds of `.starcistacks/dev/seeds`.
 * A failure removes whatever was started before it is rethrown: jest does not call the teardown after a failed setup.
 */
import "tsconfig-paths/register"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Client } from "pg"
import { freePorts } from "@tests/world/kit/free-ports"
import { retryUntil } from "@tests/world/kit/readiness"
import { runToken, secret } from "@tests/world/kit/run-tokens"
import { EnvSource } from "@modules/platform/config"
import { bootstrap } from "../../../apps/migrate/src/main"
import { postgresAccepts, removeContainer, runPostgres } from "./docker.client"
import { writeWorldState } from "./test-world-state.service"
import type { TestDatabaseState } from "./test-world-state.service"

const DATABASE_USER = "e2e"
const DATABASE_READY_DEADLINE_MS = 120_000
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

const startDatabase = async (runId: string, connection: string, hostPort: number): Promise<TestDatabaseState> => {
    const container = `ecommerce-e2e-${connection}-${runId}`
    const database = `ecommerce_${connection}`
    const password = secret()
    runPostgres({ name: container, runId, hostPort, user: DATABASE_USER, password, database })
    await retryUntil(`the ${connection} database accepts connections`, DATABASE_READY_DEADLINE_MS, () =>
        Promise.resolve(postgresAccepts(container, DATABASE_USER, database)),
    )
    return {
        container,
        user: DATABASE_USER,
        database,
        url: `postgres://${DATABASE_USER}:${password}@127.0.0.1:${hostPort}/${database}`,
    }
}

/** Starts the shared infrastructure of the run and publishes its coordinates. */
export default async function globalSetup(): Promise<void> {
    const runId = runToken(4)
    const started: Array<string> = []
    try {
        const [identityPort = 0, orderPort = 0] = await freePorts(2)
        const identity = await startDatabase(runId, "identity", identityPort)
        started.push(identity.container)
        const order = await startDatabase(runId, "order", orderPort)
        started.push(order.container)
        await bootstrap(new EnvSource({ IDENTITY_DB_URL: identity.url, ORDER_DB_URL: order.url }))
        await applySeed(identity.url, "identity-demo.sql")
        await applySeed(order.url, "order-catalog.sql")
        writeWorldState({ runId, identity, order })
    } catch (error) {
        started.forEach(removeContainer)
        throw error
    }
}
