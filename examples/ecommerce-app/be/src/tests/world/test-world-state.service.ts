/**
 * The hand-over between the jest globalSetup and the spec workers: one small JSON file under the OS temp dir that
 * carries the coordinates of the shared infrastructure (one migrated Postgres container per connection, one Redis). Its path travels
 * in one environment variable; the world is the only place that writes `process.env`.
 */
import { randomUUID } from "node:crypto"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

/** The environment variable that carries the path of the state file. */
export const STATE_FILE_ENV = "TEST_WORLD_STATE_FILE"

/** One Postgres container of the run. */
export interface TestDatabaseState {
    /** The run-scoped container name. */
    readonly container: string
    /** The superuser of the container. */
    readonly user: string
    /** The database created in it. */
    readonly database: string
    /** The connection URL of the migrated and seeded database. */
    readonly url: string
}

/** The Redis container of the run, behind the cache integration. */
export interface TestRedisState {
    /** The run-scoped container name. */
    readonly container: string
    /** The `redis://` URL the cache integration is configured with. */
    readonly url: string
}

/** The coordinates of the shared infrastructure of one run. */
export interface TestWorldState {
    /** The run token; it names the containers. */
    readonly runId: string
    /** The database of the identity connection. */
    readonly identity: TestDatabaseState
    /** The database of the order connection. */
    readonly order: TestDatabaseState
    /** The Redis of the cache integration. */
    readonly redis: TestRedisState
}

const isDatabase = (value: unknown): value is TestDatabaseState => {
    if (typeof value !== "object" || value === null) return false
    const record = new Map(Object.entries(value))
    return ["container", "user", "database", "url"].every((key) => typeof record.get(key) === "string")
}

const isRedis = (value: unknown): value is TestRedisState => {
    if (typeof value !== "object" || value === null) return false
    const record = new Map(Object.entries(value))
    return ["container", "url"].every((key) => typeof record.get(key) === "string")
}

const isState = (value: unknown): value is TestWorldState => {
    if (typeof value !== "object" || value === null) return false
    const record = new Map(Object.entries(value))
    return (
        typeof record.get("runId") === "string" &&
        isDatabase(record.get("identity")) &&
        isDatabase(record.get("order")) &&
        isRedis(record.get("redis"))
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
