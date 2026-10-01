/**
 * The hand-over between the jest globalSetup and the spec workers: one small JSON file under the OS temp dir that
 * carries the coordinates of the shared infrastructure (database URL, fakes, upload directory) and the run-generated test
 * secrets. Its path travels in one environment variable; the world is the only place that writes `process.env`.
 */
import { randomUUID } from "node:crypto"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

/** The environment variable that carries the path of the state file. */
export const STATE_FILE_ENV = "TEST_WORLD_STATE_FILE"

/** The coordinates of the shared infrastructure of one run. */
export interface TestWorldState {
    /** The run token; it names the database container. */
    readonly runId: string
    /** The name of the Postgres container. */
    readonly databaseContainer: string
    /** The database user of the container. */
    readonly databaseUser: string
    /** The database name of the container. */
    readonly databaseName: string
    /** The connection URL of the migrated database. */
    readonly databaseUrl: string
    /** The base URL of the fakes control server. */
    readonly controlUrl: string
    /** The token endpoint of the identity provider fake. */
    readonly keycloakTokenUrl: string
    /** The client id the identity provider fake accepts. */
    readonly keycloakClientId: string
    /** The loopback port of the mail host fake. */
    readonly smtpPort: number
    /** The base URL of the payment gateway fake. */
    readonly sepayBaseUrl: string
    /** The API key the application presents to the payment gateway fake. */
    readonly sepayApiKey: string
    /** The shared secret the payment gateway fake signs webhooks with. */
    readonly sepayWebhookSecret: string
    /** The run-owned directory that holds uploaded objects. */
    readonly uploadDir: string
    /** The secret that signs presigned upload tokens. */
    readonly uploadSigningSecret: string
}

const STRING_KEYS: ReadonlyArray<Exclude<keyof TestWorldState, "smtpPort">> = [
    "runId",
    "databaseContainer",
    "databaseUser",
    "databaseName",
    "databaseUrl",
    "controlUrl",
    "keycloakTokenUrl",
    "keycloakClientId",
    "sepayBaseUrl",
    "sepayApiKey",
    "sepayWebhookSecret",
    "uploadDir",
    "uploadSigningSecret",
]

const isState = (value: unknown): value is TestWorldState => {
    if (typeof value !== "object" || value === null) return false
    const record = new Map(Object.entries(value))
    return STRING_KEYS.every((key) => typeof record.get(key) === "string") && typeof record.get("smtpPort") === "number"
}

const missing = (detail: string, cause?: unknown): TestWorldError =>
    new TestWorldError({ code: TestWorldErrorCode.StateMissing, params: { detail }, cause })

/** Writes the state file of the run and publishes its path in the environment. */
export const writeWorldState = (state: TestWorldState): void => {
    const path = join(tmpdir(), `todo-test-world-${randomUUID()}.json`)
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
