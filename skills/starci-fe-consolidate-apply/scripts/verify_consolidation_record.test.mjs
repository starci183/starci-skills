import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

const verifier = new URL("./verify_consolidation_record.mjs", import.meta.url).pathname.replace(/^\/(.:)/, "$1")

const CALL_SITES = ["src/app/dashboard/page.tsx", "src/app/profile/page.tsx"]

const parity = (callSite, index) => ({
    callSite,
    stateId: `${callSite}-populated-desktop-light-en`,
    identical: true,
    before: { path: `before-${index}.png`, sha256: "" },
    after: { path: `after-${index}.png`, sha256: "" },
})

/** An approved survey plus the record that applies it, both valid. */
const write = (patchRecord = () => {}, patchPlan = () => {}) => {
    const root = mkdtempSync(join(tmpdir(), "starci-consolidate-apply-"))
    CALL_SITES.forEach((_, index) => {
        writeFileSync(join(root, `before-${index}.png`), `before-${index}`)
        writeFileSync(join(root, `after-${index}.png`), `after-${index}`)
    })

    const planPath = join(root, "consolidation-plan.json")
    const plan = {
        version: 1,
        task: "two streak cards look alike",
        contextLock: join(root, "context-lock.consolidate-plan.json"),
        scope: "src/components/blocks/dashboard",
        status: "verdicts-approved",
        approvalKind: "explicit",
        approvalEvidence: "merge the streak cards",
        clusters: [{
            clusterId: "streak-card",
            verdict: "merge",
            members: [{ path: "a.tsx", tier: "block" }, { path: "b.tsx", tier: "block" }],
            callSites: [...CALL_SITES],
            canonicalTarget: "a.tsx",
        }],
    }
    patchPlan(plan)
    writeFileSync(planPath, JSON.stringify(plan, null, 2))

    const recordPath = join(root, "consolidation-record.json")
    const record = {
        version: 1,
        task: "two streak cards became one",
        contextLock: join(root, "context-lock.consolidate-apply.json"),
        planRecord: planPath,
        writeBoundary: { confirmed: true, confirmationEvidence: "yes, that boundary is right" },
        clusters: [{
            clusterId: "streak-card",
            callSites: [...CALL_SITES],
            supersededRemoved: true,
            parity: CALL_SITES.map(parity),
        }],
    }
    patchRecord(record, root)
    writeFileSync(recordPath, JSON.stringify(record, null, 2))
    return recordPath
}

const accepts = (patchRecord, patchPlan) => {
    const output = execFileSync(process.execPath, [verifier, write(patchRecord, patchPlan), "--seal"], { encoding: "utf8" })
    assert.equal(JSON.parse(output).ok, true)
}

const refuses = (patchRecord, pattern, patchPlan) => {
    const result = spawnSync(process.execPath, [verifier, write(patchRecord, patchPlan), "--seal"], { encoding: "utf8" })
    assert.notEqual(result.status, 0, `accepted a record it should refuse: ${pattern}`)
    assert.match(result.stderr, pattern)
}

test("accepts an applied cluster where every measured call site rendered identically", () => {
    accepts(() => {})
})

test("refuses applying a cluster the survey never approved", () => {
    refuses((record) => { record.clusters[0].clusterId = "invented-cluster" }, /was never surveyed and approved/)
})

test("refuses editing a pair the survey deliberately kept apart", () => {
    refuses(() => {}, /kept this pair apart, and Apply edited it anyway/, (plan) => {
        plan.clusters[0].verdict = "keep-apart"
        plan.clusters[0].reason = "different domain entities"
    })
})

test("refuses applying a survey nobody approved", () => {
    refuses(() => {}, /is not approved, so there is nothing to apply/, (plan) => {
        plan.status = "verdicts-proposed"
    })
})

test("refuses touching a call site the survey never measured", () => {
    refuses((record) => {
        record.clusters[0].callSites.push("src/app/league/page.tsx")
    }, /touches call sites the survey never measured/)
})

test("refuses leaving a measured call site behind", () => {
    refuses((record) => {
        record.clusters[0].callSites.pop()
        record.clusters[0].parity.pop()
    }, /leaves measured call sites behind/)
})

test("refuses a call site with no before and after render", () => {
    refuses((record) => { record.clusters[0].parity.pop() }, /has no before\/after render/)
})

test("refuses a call site whose render changed", () => {
    refuses((record) => { record.clusters[0].parity[1].identical = false }, /ownership changed the screen/)
})

test("refuses leaving the superseded owner behind", () => {
    refuses((record) => { record.clusters[0].supersededRemoved = false }, /superseded owner and its story must be removed/)
})

test("refuses edits before the write boundary was confirmed", () => {
    refuses((record) => { record.writeBoundary.confirmed = false }, /writeBoundary\.confirmed must be true/)
})

test("refuses a record that inherits no survey at all", () => {
    refuses((record) => { record.planRecord = "" }, /planRecord is required/)
})

test("detects a render replaced after sealing", () => {
    const recordPath = write()
    execFileSync(process.execPath, [verifier, recordPath, "--seal"])
    writeFileSync(join(recordPath, "..", "after-0.png"), "quietly re-rendered")
    const result = spawnSync(process.execPath, [verifier, recordPath], { encoding: "utf8" })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /render hash drift/)
})
