/**
 * The hand-over between the jest globalSetup (parent process) and the spec workers: one small JSON file under the OS temp
 * dir that carries the coordinates of the run (the attached stack, the fakes host, sibling services, run directories).
 * Its path travels in one environment variable; the library is the only place that touches `process.env`.
 */
import { randomUUID } from "node:crypto"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { TestWorldErrorCode, worldError } from "../errors"
import type { Namespace, RunInfra } from "../stack/contracts"

/** The environment variable that carries the path of the state file. */
export const STATE_FILE_ENV = "STARCI_TEST_WORLD_STATE"

/** A fake as the world published it. */
export interface RunFake {
    readonly url: string
    readonly host: string
    readonly port: number
    readonly values: Readonly<Record<string, string>>
    readonly endpoints: Readonly<Record<string, string>>
}

/** A sibling service container of the run. */
export interface RunService {
    readonly url: string
    readonly host: string
    readonly port: number
    readonly container: string
}

/** The coordinates of one run: everything a spec worker needs to boot apps against the shared infrastructure. */
export interface RunContext {
    readonly version: 1
    readonly runId: string
    readonly namespace: Namespace
    /** Seed of `secret(label)`: the same label gives the same secret in the setup and in every worker. */
    readonly secretSeed: string
    readonly infra: RunInfra
    readonly fakes: { readonly controlUrl: string; readonly entries: Readonly<Record<string, RunFake>> }
    readonly services: Readonly<Record<string, RunService>>
    /** Run-owned directories by name, removed by the teardown. */
    readonly directories: Readonly<Record<string, string>>
    /** Per connection: tables the per-spec reset keeps (declared `keep` plus every table the migrate/seed step filled). */
    readonly keepTables: Readonly<Record<string, ReadonlyArray<string>>>
    /** Absolute repository root. */
    readonly root: string
}

const missing = (detail: string, cause?: unknown) => worldError(TestWorldErrorCode.StateMissing, detail, cause)

/** Writes the state file of the run and publishes its path in the environment. */
export const writeRunContext = (context: RunContext): string => {
    const path = join(tmpdir(), `starci-test-world-${randomUUID()}.json`)
    writeFileSync(path, JSON.stringify(context), "utf8")
    process.env[STATE_FILE_ENV] = path
    return path
}

let cached: RunContext | null = null

/** Reads the state file of the run; the world was not started by the globalSetup when it is absent. */
export const readRunContext = (): RunContext => {
    if (cached !== null) return cached
    const path = process.env[STATE_FILE_ENV]
    if (path === undefined || path === "") {
        throw missing(`${STATE_FILE_ENV} is not set: the jest globalSetup of the test world did not run (src/tests/world/global-setup.ts must re-export @starci/test-world/global-setup)`)
    }
    try {
        const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
        if (typeof parsed === "object" && parsed !== null && (parsed as { version?: unknown }).version === 1) {
            cached = parsed as RunContext
            return cached
        }
    } catch (cause) {
        throw missing(`the state file ${path} cannot be read`, cause)
    }
    throw missing(`the state file ${path} is malformed`)
}

/** Removes the state file of the run and its environment variable. */
export const removeRunContext = (): void => {
    const path = process.env[STATE_FILE_ENV]
    if (path !== undefined) rmSync(path, { force: true })
    delete process.env[STATE_FILE_ENV]
    cached = null
}
