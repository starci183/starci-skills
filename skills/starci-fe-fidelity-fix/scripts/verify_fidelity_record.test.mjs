import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

const verifier = new URL("./verify_fidelity_record.mjs", import.meta.url).pathname.replace(/^\/(.:)/, "$1")

const side = (commit, render, overrides = {}) => ({
    commit,
    route: "/dashboard",
    viewport: { width: 1440, height: 1000, dpr: 1 },
    locale: "en",
    theme: "light",
    authPersona: "owner",
    ownerState: "populated",
    fixtureSha256: "fixture-hash",
    render: { path: render, sha256: "" },
    ...overrides,
})

/** A valid record, so each test moves exactly one thing away from valid. */
const write = (patch = () => {}) => {
    const root = mkdtempSync(join(tmpdir(), "starci-fidelity-"))
    writeFileSync(join(root, "before.png"), "legacy-render")
    writeFileSync(join(root, "after.png"), "target-render")
    const recordPath = join(root, "fidelity-record.json")
    const record = {
        version: 1,
        task: "restore the activity row divider",
        contextLock: join(root, "context-lock.fidelity.json"),
        owner: "block-activity-feed",
        files: ["src/components/blocks/feed/ActivityFeed/component.tsx"],
        bindingEvidence: {
            kind: "legacy-source",
            source: "starci-academy/src/components/blocks/feed/ActivityFeed at a1b2c3d",
        },
        writeBoundary: { confirmed: true, confirmationEvidence: "yes, that boundary is right" },
        touchedStates: [{
            stateId: "activity-populated-desktop-light-en",
            ownerId: "block-activity-feed",
            before: side("a1b2c3d", "before.png"),
            after: side("06d0649", "after.png"),
        }],
    }
    patch(record)
    writeFileSync(recordPath, JSON.stringify(record, null, 2))
    return recordPath
}

const refuses = (patch, pattern) => {
    const result = spawnSync(process.execPath, [verifier, write(patch), "--seal"], { encoding: "utf8" })
    assert.notEqual(result.status, 0, `accepted a record it should refuse: ${pattern}`)
    assert.match(result.stderr, pattern)
}

test("accepts a same-state before and after taken at different commits", () => {
    const output = execFileSync(process.execPath, [verifier, write(), "--seal"], { encoding: "utf8" })
    assert.equal(JSON.parse(output).ok, true)
})

test("refuses an owner render compared against a visitor render", () => {
    refuses((record) => { record.touchedStates[0].after.authPersona = "visitor" }, /compares two different states/)
})

test("refuses a populated render compared against an empty one", () => {
    refuses((record) => { record.touchedStates[0].before.ownerState = "empty" }, /compares two different states/)
})

test("refuses a light render compared against a dark one", () => {
    refuses((record) => { record.touchedStates[0].after.theme = "dark" }, /compares two different states/)
})

test("refuses two different seeds wearing the same state name", () => {
    refuses((record) => { record.touchedStates[0].after.fixtureSha256 = "another-seed" }, /compares two different states/)
})

test("refuses a comparison taken at two different viewports", () => {
    refuses((record) => { record.touchedStates[0].after.viewport.width = 390 }, /viewport\.width/)
})

test("refuses a repair whose expected result is only this run's judgement", () => {
    refuses((record) => { record.bindingEvidence.kind = "looked-wrong" }, /bindingEvidence\.kind must be one of/)
})

test("refuses edits before the write boundary was confirmed", () => {
    refuses((record) => { record.writeBoundary.confirmed = false }, /writeBoundary\.confirmed must be true/)
})

test("refuses a touched state belonging to another owner", () => {
    refuses((record) => { record.touchedStates[0].ownerId = "block-somewhere-else" }, /not to the frozen owner/)
})

test("refuses evidence that was never captured", () => {
    refuses((record) => { record.touchedStates[0].after.render.path = "missing.png" }, /points at a file that is not there/)
})

test("detects render drift after sealing", () => {
    const recordPath = write()
    execFileSync(process.execPath, [verifier, recordPath, "--seal"])
    writeFileSync(join(recordPath, "..", "after.png"), "re-rendered later")
    const result = spawnSync(process.execPath, [verifier, recordPath], { encoding: "utf8" })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /render hash drift/)
})
