/**
 * The hand-over between the jest globalSetup (parent process) and the spec workers: one small JSON file under the OS temp
 * dir that carries the coordinates of every data slot of the run (each slot: the attached stack, the fakes host, sibling
 * services, run directories). Its path travels in {@link STATE_FILE_ENV}; the slot a spec process owns travels in
 * {@link SLOT_ENV}, set by `@starci/jest-preset`'s world runner when it forks the process. The state protocol is
 * {@link STATE_VERSION}; the preset's runner speaks exactly that one (the pair is pinned together, never a fallback).
 */
import { randomUUID } from "node:crypto"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { TestWorldErrorCode, worldError } from "../errors"
import type { Namespace, RunInfra } from "../stack/contracts"

/** The environment variable that carries the path of the state file. */
export const STATE_FILE_ENV = "STARCI_TEST_WORLD_STATE"

/** The environment variable that carries the slot (1-based) of a spec process; the preset's world runner sets it per file. */
export const SLOT_ENV = "STARCI_TEST_WORLD_SLOT"

/** The state-file protocol; `@starci/jest-preset`'s world runner reads this version only. */
export const STATE_VERSION = 2

/** `<name>@<version>` of this library, written into the state file so a mismatch names both sides. */
export const LIBRARY = ((): string => {
    const own = JSON.parse(readFileSync(resolve(__dirname, "..", "..", "package.json"), "utf8")) as { name: string; version: string }
    return `${own.name}@${own.version}`
})()

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

/** The coordinates of one data slot of a run: everything a spec process needs to boot apps against the shared infrastructure. */
export interface RunContext {
    /** The slot (1-based); its namespace, runId, fakes, proxies and run directory are its own. */
    readonly slot: number
    /** The slot's run token (`<run token>-w<slot>`): its leases and toxiproxy proxies carry it. */
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

/** What the state file holds: every slot of the run. */
export interface RunState {
    readonly version: typeof STATE_VERSION
    /** The library that wrote the file (`@starci/test-world@<version>`). */
    readonly library: string
    /** The run token the slot tokens derive from. */
    readonly runId: string
    readonly slots: ReadonlyArray<RunContext>
}

const missing = (detail: string, cause?: unknown) => worldError(TestWorldErrorCode.StateMissing, detail, cause)

/** Writes the state file of the run (every slot) and publishes its path in the environment. */
export const writeRunState = (runId: string, slots: ReadonlyArray<RunContext>): string => {
    const state: RunState = { version: STATE_VERSION, library: LIBRARY, runId, slots }
    const path = join(tmpdir(), `starci-test-world-${randomUUID()}.json`)
    writeFileSync(path, JSON.stringify(state), "utf8")
    process.env[STATE_FILE_ENV] = path
    return path
}

let cached: RunContext | null = null

const readState = (path: string): RunState => {
    let parsed: unknown
    try {
        parsed = JSON.parse(readFileSync(path, "utf8"))
    } catch (cause) {
        throw missing(`the state file ${path} cannot be read`, cause)
    }
    const state = parsed as Partial<RunState> | null
    if (typeof state !== "object" || state === null || state.version !== STATE_VERSION || !Array.isArray(state.slots)) {
        throw worldError(
            TestWorldErrorCode.PairMismatch,
            `the state file ${path} is protocol ${String(state?.version)} (${String(state?.library ?? "unknown writer")}), ${LIBRARY} reads ${STATE_VERSION}: pin @starci/test-world and @starci/jest-preset together as knowledge/hfs/canon-pins.yaml pairs them`,
        )
    }
    return state as RunState
}

/**
 * The context of this process's slot. The state file must exist (the globalSetup ran) and {@link SLOT_ENV} must name one of
 * its slots: a spec process the paired world runner did not start has no slot, a typed failure, never a silent shared slot.
 */
export const readRunContext = (): RunContext => {
    if (cached !== null) return cached
    const path = process.env[STATE_FILE_ENV]
    if (path === undefined || path === "") {
        throw missing(`${STATE_FILE_ENV} is not set: the jest globalSetup of the test world did not run (src/tests/world/global-setup.ts must re-export @starci/test-world/global-setup)`)
    }
    const state = readState(path)
    const raw = process.env[SLOT_ENV]
    const slot = raw === undefined ? Number.NaN : Number(raw)
    const context = state.slots.find((entry) => entry.slot === slot)
    if (context === undefined) {
        throw worldError(
            TestWorldErrorCode.PairMismatch,
            `${SLOT_ENV}=${String(raw)} names none of the run's ${state.slots.length} slot(s): spec files run on the world runner of the @starci/jest-preset paired with ${LIBRARY} (knowledge/hfs/canon-pins.yaml), which binds each file to a slot`,
        )
    }
    cached = context
    return cached
}

/** Removes the state file of the run and its environment variable. */
export const removeRunState = (): void => {
    const path = process.env[STATE_FILE_ENV]
    if (path !== undefined) rmSync(path, { force: true })
    delete process.env[STATE_FILE_ENV]
    cached = null
}
