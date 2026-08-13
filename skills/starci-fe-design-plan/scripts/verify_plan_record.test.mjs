import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

const verifier = new URL("./verify_plan_record.mjs", import.meta.url).pathname.replace(/^\/(.:)/, "$1")

const direction = (directionId, posture) => ({
    directionId,
    posture,
    thesis: `${directionId} leads with a different decision model`,
    primaryCta: "Continue where you left off",
    readingOrder: ["continuity", "goal", "people"],
    tradeoffs: ["defers the goal deficit"],
    legacyDivergence: [],
    implementationFeasibility: {
        status: "mapped",
        existingOwners: ["block-daily-quest"],
        existingContracts: ["surface-list-card"],
        exactProposals: [],
        unmappedAnatomy: [],
    },
    representativeSceneId: `${directionId}-default`,
})

/** A record that passes, so every test below changes exactly one thing away from valid. */
const write = (overrides = {}) => {
    const root = mkdtempSync(join(tmpdir(), "starci-plan-record-"))
    const recordPath = join(root, "plan-record.json")
    writeFileSync(recordPath, JSON.stringify({
        version: 2,
        task: "dashboard system",
        status: "directions-shown",
        contextLock: join(root, "context-lock.plan.json"),
        caseId: "case-dashboard-system",
        deliveryMode: "single",
        mode: "creative",
        renderStatus: "directional-not-apply-baseline",
        parityBaseline: null,
        workItems: [],
        evidence: [],
        unknowns: [],
        businessCapabilities: [],
        directions: [direction("direction-a", "conservative"), direction("direction-b", "bold")],
        stateManifest: [],
        directionLab: {
            path: join(root, "lab"),
            url: "http://127.0.0.1:8080/",
            caseId: "case-dashboard-system",
            directionIds: ["direction-a", "direction-b"],
        },
        selectedDirectionId: null,
        blockTrees: [],
        contracts: [],
        vocabularyProposals: [],
        backendEnablerProposals: [],
        ...overrides,
    }, null, 2))
    return recordPath
}

const refuses = (overrides, pattern) => {
    const result = spawnSync(process.execPath, [verifier, write(overrides)], { encoding: "utf8" })
    assert.notEqual(result.status, 0, `accepted a record it should refuse: ${pattern}`)
    assert.match(result.stderr, pattern)
}

test("accepts a complete record showing directions before any selection", () => {
    const output = execFileSync(process.execPath, [verifier, write()], { encoding: "utf8" })
    assert.equal(JSON.parse(output).ok, true)
})

test("accepts an explicit selection that quotes the user", () => {
    const output = execFileSync(process.execPath, [verifier, write({
        status: "direction-selected",
        selectedDirectionId: "direction-b",
        selectionKind: "explicit",
        selectionEvidence: "go with B",
    })], { encoding: "utf8" })
    assert.equal(JSON.parse(output).ok, true)
})

test("refuses a case that is not a choice between two to four directions", () => {
    refuses({ directions: [direction("direction-a", "conservative")], directionLab: undefined }, /two to four directions/)
})

test("refuses a direction that claims mapped while naming anatomy it cannot express", () => {
    const broken = direction("direction-a", "conservative")
    broken.implementationFeasibility.unmappedAnatomy = ["split hero with inline editor"]
    refuses({ directions: [broken, direction("direction-b", "bold")] }, /claims mapped while naming unmapped anatomy/)
})

test("refuses a selection that records nobody selecting", () => {
    refuses({
        status: "direction-selected",
        selectedDirectionId: "direction-b",
        selectionKind: "explicit",
        selectionEvidence: "",
    }, /must quote the user's words/)
})

test("refuses a default that falls to anything but the direction risking least", () => {
    refuses({
        status: "direction-selected",
        selectedDirectionId: "direction-b",
        selectionKind: "default-after-ambiguity",
        defaultReason: "asked twice, answer stayed 'either is fine'",
    }, /may only fall to the conservative direction/)
})

test("accepts a default that falls to the conservative direction and says why", () => {
    const output = execFileSync(process.execPath, [verifier, write({
        status: "direction-selected",
        selectedDirectionId: "direction-a",
        selectionKind: "default-after-ambiguity",
        defaultReason: "asked twice, answer stayed 'either is fine'",
    })], { encoding: "utf8" })
    assert.equal(JSON.parse(output).ok, true)
})

test("refuses migration work with nothing to preserve and no parity-first direction", () => {
    refuses({ mode: "migration" }, /requires a named parityBaseline/)
})

test("refuses a direction the lab never rendered", () => {
    refuses({
        directionLab: {
            path: "lab", url: "http://127.0.0.1:8080/",
            caseId: "case-dashboard-system", directionIds: ["direction-a"],
        },
    }, /directions with no lab scene: direction-b/)
})

test("refuses a record that promotes its own mockup out of directional status", () => {
    refuses({ renderStatus: "approved" }, /renderStatus must be directional-not-apply-baseline/)
})
