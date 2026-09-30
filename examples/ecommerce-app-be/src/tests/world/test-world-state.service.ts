/**
 * The hand-over between the jest globalSetup and the spec workers: one small JSON file under the OS temp dir that
 * carries the coordinates of the shared infrastructure (the running stack, one migrated database per connection, the run's Redis database). Its path travels
 * in one environment variable; the world is the only place that writes `process.env`.
 */
import { randomUUID } from "node:crypto"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { isTestStack } from "./stack.client"
import type { TestStack } from "./stack.client"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

/** The environment variable that carries the path of the state file. */
export const STATE_FILE_ENV = "TEST_WORLD_STATE_FILE"

/** One database of the run inside the stack's Postgres. */
export interface TestDatabaseState {
    /** The database name (created for this run, dropped at its end). */
    readonly database: string
    /** The connection URL of the migrated and seeded database through its proxy: what the apps under test connect to. */
    readonly url: string
    /** The connection URL of the same database on the service itself: the world's own reads. */
    readonly directUrl: string
}

/** The coordinates of the shared infrastructure of one run. */
export interface TestWorldState {
    /** The run token; it names the run's databases and picks its Redis database. */
    readonly runId: string
    /** True when this run's globalSetup started the stack (its globalTeardown stops it); false when it attached to a warm stack. */
    readonly ownsStack: boolean
    /** The running stack: every service of `.starcistacks/dev` for real, each behind a toxiproxy proxy. */
    readonly stack: TestStack
    /** The database of the identity connection. */
    readonly identity: TestDatabaseState
    /** The database of the order connection. */
    readonly order: TestDatabaseState
    /** The `redis://` URL the apps under test connect to (through the proxy), on the run's own Redis database. */
    readonly cacheUrl: string
}

const isDatabase = (value: unknown): value is TestDatabaseState => {
    if (typeof value !== "object" || value === null) return false
    const record = new Map(Object.entries(value))
    return ["database", "url", "directUrl"].every((key) => typeof record.get(key) === "string")
}

const isState = (value: unknown): value is TestWorldState => {
    if (typeof value !== "object" || value === null) return false
    const record = new Map(Object.entries(value))
    return (
        typeof record.get("runId") === "string" &&
        typeof record.get("ownsStack") === "boolean" &&
        isTestStack(record.get("stack")) &&
        isDatabase(record.get("identity")) &&
        isDatabase(record.get("order")) &&
        typeof record.get("cacheUrl") === "string"
    )
}

const missing = (detail: string, cause?: unknown): TestWorldError =>
    new TestWorldError({ code: TestWorldErrorCode.StateMissing, params: { detail }, cause })

/** Writes the state file of the run and publishes its path in the environment. */
export const writeWorldState = (state: TestWorldState): void => {
    const path = join(tmpdir(), `ecommerce-test-world-${randomUUID()}.json`)
    writeFileSync(path, JSON.stringify(state), "utf8")
    process.env[STATE_FILE_ENV] = path
}

/** Reads the state file of the run; the world was not started by globalSetup when it is absent. */
export const readWorldState = (): TestWorldState => {
    const path = process.env[STATE_FILE_ENV]
    if (path === undefined)
        throw missing(`${STATE_FILE_ENV} is not set: the jest globalSetup of the test world did not run`)
    try {
        const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
        if (isState(parsed)) return parsed
    } catch (cause) {
        throw missing(`the state file ${path} cannot be read`, cause)
    }
    throw missing(`the state file ${path} is malformed`)
}

/** Removes the state file of the run and its environment variable. */
export const removeWorldState = (): void => {
    const path = process.env[STATE_FILE_ENV]
    if (path !== undefined) rmSync(path, { force: true })
    delete process.env[STATE_FILE_ENV]
}
