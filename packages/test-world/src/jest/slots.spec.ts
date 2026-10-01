import assert from "node:assert/strict"
import { rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import type { AnyTestWorldConfig } from "../config/types"
import { TestWorldErrorCode } from "../errors"
import { LIBRARY, SLOT_ENV, STATE_FILE_ENV, STATE_VERSION, readRunContext, removeRunState, writeRunState } from "./context"
import type { RunContext } from "./context"
import { DEFAULT_WORKERS, slotCountOf, withRealmUserIds } from "./setup"

const slotContext = (slot: number): RunContext => ({
    slot,
    runId: `run-w${slot}`,
    namespace: { snake: `shop_a1b2c3_w${slot}`, kebab: `shop-a1b2c3-w${slot}`, root: "/repo" },
    secretSeed: "seed",
    infra: { toxiproxyApi: "http://127.0.0.1:1" },
    fakes: { controlUrl: `http://127.0.0.1:${4000 + slot}`, entries: {} },
    services: {},
    directories: { run: join(tmpdir(), `tw-slot-${slot}`) },
    keepTables: {},
    root: "/repo",
})

const code = (cause: unknown): unknown => (cause as { code?: unknown }).code

test.afterEach(() => {
    removeRunState()
    delete process.env[SLOT_ENV]
})

test("the state file carries every slot, and a process reads the slot the runner bound it to", () => {
    writeRunState("run", [slotContext(1), slotContext(2)])
    process.env[SLOT_ENV] = "2"
    const context = readRunContext()
    assert.equal(context.slot, 2)
    assert.equal(context.namespace.snake, "shop_a1b2c3_w2")
    assert.equal(context.fakes.controlUrl, "http://127.0.0.1:4002")
    assert.match(LIBRARY, /^@starci\/test-world@\d+\.\d+\.\d+/)
    assert.equal(STATE_VERSION, 2)
})

test("a process with no slot, or a slot the run does not have, is a PairMismatch: never a silently shared slot", () => {
    writeRunState("run", [slotContext(1), slotContext(2)])
    assert.throws(() => readRunContext(), (cause: unknown) => code(cause) === TestWorldErrorCode.PairMismatch && /STARCI_TEST_WORLD_SLOT=undefined/.test(String(cause)))
    process.env[SLOT_ENV] = "3"
    assert.throws(() => readRunContext(), (cause: unknown) => code(cause) === TestWorldErrorCode.PairMismatch && /none of the run's 2 slot/.test(String(cause)))
})

test("a state file of another protocol (test-world before 1.1.0) is a PairMismatch naming both sides", () => {
    const path = join(tmpdir(), `tw-v1-${process.pid}.json`)
    writeFileSync(path, JSON.stringify({ version: 1, runId: "x" }))
    process.env[STATE_FILE_ENV] = path
    process.env[SLOT_ENV] = "1"
    try {
        assert.throws(
            () => readRunContext(),
            (cause: unknown) => code(cause) === TestWorldErrorCode.PairMismatch && String(cause).includes("protocol 1") && String(cause).includes(LIBRARY),
        )
    } finally {
        rmSync(path, { force: true })
    }
})

test("a run has one slot per jest worker, capped by the declaration's workers (default 2), never fewer than one", () => {
    const config = (workers?: number): AnyTestWorldConfig => ({ workers }) as unknown as AnyTestWorldConfig
    assert.equal(DEFAULT_WORKERS, 2)
    assert.equal(slotCountOf(config(), 7), 2)
    assert.equal(slotCountOf(config(), 1), 1)
    assert.equal(slotCountOf(config(), undefined), 1)
    assert.equal(slotCountOf(config(3), 7), 3)
    assert.equal(slotCountOf(config(3), 2), 2)
})

test("a slot's seeds name the realm users by the ids the slot's realm stores them under", () => {
    const pinned = "4f1c2b7e-8a3d-4e5f-9b6a-0c1d2e3f4a5b"
    const context = { infra: { toxiproxyApi: "x", keycloak: { userIds: { [pinned]: "stored-id" } } } } as unknown as RunContext
    assert.equal(withRealmUserIds(`INSERT INTO persons (id) VALUES ('${pinned}'); -- ${pinned}`, context), "INSERT INTO persons (id) VALUES ('stored-id'); -- stored-id")
    assert.equal(withRealmUserIds("SELECT 1", { infra: { toxiproxyApi: "x" } } as unknown as RunContext), "SELECT 1")
})
