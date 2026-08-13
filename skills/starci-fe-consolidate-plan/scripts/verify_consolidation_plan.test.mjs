import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

const verifier = new URL("./verify_consolidation_plan.mjs", import.meta.url).pathname.replace(/^\/(.:)/, "$1")

/** A valid survey so each test moves exactly one thing away from valid. */
const write = (patch = () => {}) => {
    const root = mkdtempSync(join(tmpdir(), "starci-consolidate-plan-"))
    const planPath = join(root, "consolidation-plan.json")
    const plan = {
        version: 1,
        task: "two streak cards look alike",
        contextLock: join(root, "context-lock.consolidate-plan.json"),
        scope: "src/components/blocks/dashboard",
        status: "verdicts-approved",
        approvalKind: "explicit",
        approvalEvidence: "merge the streak cards, leave the rest",
        clusters: [{
            clusterId: "streak-card",
            verdict: "merge",
            members: [
                { path: "src/components/blocks/dashboard/StreakCard/component.tsx", tier: "block" },
                { path: "src/components/blocks/profile/StreakSummary/component.tsx", tier: "block" },
            ],
            callSites: ["src/app/dashboard/page.tsx", "src/app/profile/page.tsx"],
            canonicalTarget: "src/components/blocks/dashboard/StreakCard/component.tsx",
        }],
    }
    patch(plan, root)
    writeFileSync(planPath, JSON.stringify(plan, null, 2))
    return planPath
}

const accepts = (patch) => {
    const output = execFileSync(process.execPath, [verifier, write(patch)], { encoding: "utf8" })
    assert.equal(JSON.parse(output).ok, true)
}

const refuses = (patch, pattern) => {
    const result = spawnSync(process.execPath, [verifier, write(patch)], { encoding: "utf8" })
    assert.notEqual(result.status, 0, `accepted a survey it should refuse: ${pattern}`)
    assert.match(result.stderr, pattern)
}

test("accepts a surveyed and approved merge", () => {
    accepts(() => {})
})

test("accepts verdicts still awaiting approval", () => {
    accepts((plan) => {
        plan.status = "verdicts-proposed"
        delete plan.approvalKind
        delete plan.approvalEvidence
    })
})

test("refuses a survey with no stated scope", () => {
    refuses((plan) => { plan.scope = "" }, /scope is required/)
})

test("refuses call sites that were never measured", () => {
    refuses((plan) => { plan.clusters[0].callSites = [] }, /callSites must be measured before any edit/)
})

test("refuses a variant prop per call site, which means two components", () => {
    refuses((plan) => {
        plan.clusters[0].verdict = "prop-variant"
        plan.clusters[0].propDelta = {
            added: [{ name: "isDashboard", absence: "false" }, { name: "isProfile", absence: "false" }],
        }
    }, /the survey found a coincidence/)
})

test("accepts one named variant prop that states its absence", () => {
    accepts((plan) => {
        plan.clusters[0].verdict = "prop-variant"
        plan.clusters[0].propDelta = { added: [{ name: "tone", absence: "defaults to neutral" }] }
    })
})

test("refuses handing the caller an appearance slot", () => {
    refuses((plan) => {
        plan.clusters[0].verdict = "prop-variant"
        plan.clusters[0].propDelta = { added: [{ name: "className", absence: "undefined" }] }
    }, /appearance slot .*SLOTS-6 refuses/)
})

test("refuses extracting a new owner from a coincidence that happened twice", () => {
    refuses((plan) => { plan.clusters[0].verdict = "extract-composite" }, /two is an anchor, three is a pattern/)
})

test("accepts an extraction anchored at three call sites", () => {
    accepts((plan) => {
        plan.clusters[0].verdict = "extract-composite"
        plan.clusters[0].callSites.push("src/app/league/page.tsx")
    })
})

test("refuses a keep-apart verdict that never says why", () => {
    refuses((plan) => { plan.clusters[0].verdict = "keep-apart" }, /must record why these are two things/)
})

test("refuses a default that would still edit something", () => {
    refuses((plan) => {
        plan.approvalKind = "default-after-ambiguity"
        plan.defaultReason = "asked twice, answer stayed 'gộp hết đi'"
        delete plan.approvalEvidence
    }, /a default may only leave clusters alone/)
})

test("accepts a default that leaves every cluster alone", () => {
    accepts((plan) => {
        plan.approvalKind = "default-after-ambiguity"
        plan.defaultReason = "asked twice, the answer stayed ambiguous"
        delete plan.approvalEvidence
        plan.clusters[0].verdict = "keep-apart"
        plan.clusters[0].reason = "deferred: nobody confirmed these mean the same thing"
    })
})

test("refuses an approval that records nobody approving", () => {
    refuses((plan) => { plan.approvalEvidence = "" }, /must quote the user's words/)
})
