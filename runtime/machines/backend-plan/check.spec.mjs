import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { checkPlan, planHash } from "./check.mjs"

function fixture() {
    const root = mkdtempSync(join(tmpdir(), "starci-plan-"))
    mkdirSync(join(root, "cqrs"))
    writeFileSync(join(root, "cqrs", "context.md"), "# CQRS\n\n## `CQRS-1`\n")
    const plan = {
        version: 1,
        project: "academy",
        role: "be",
        sourceRevision: "123456789abc",
        planHash: "",
        objective: "add query",
        files: [{ path: "src/a.ts", holds: "query", reason: "operation" }],
        patternBindings: [{ module: "cqrs", situations: ["CQRS-1"], paths: ["src/a.ts"], evidence: ["sibling"] }],
        tests: ["returns row"],
        excluded: [],
        proof: ["unit"],
    }
    plan.planHash = planHash(plan)
    return { root, plan }
}

test("accepts a content-bound plan covering every file", () => {
    const { root, plan } = fixture()
    assert.equal(checkPlan(plan, { patternRoot: root }).ok, true)
})

test("refuses made-up modules, situations, uncovered and widened files", () => {
    const { root, plan } = fixture()
    plan.files.push({ path: "src/b.ts", holds: "handler", reason: "operation" })
    plan.patternBindings[0].situations = ["FAKE-99"]
    plan.patternBindings[0].paths.push("src/outside.ts")
    plan.patternBindings.push({ module: "made-up", situations: ["X-1"], paths: [], evidence: ["invented"] })
    plan.planHash = planHash(plan)
    const result = checkPlan(plan, { patternRoot: root })
    assert.equal(result.ok, false)
    assert.ok(result.failures.some((failure) => failure.includes("unknown situation")))
    assert.ok(result.failures.some((failure) => failure.includes("outside files")))
    assert.ok(result.failures.some((failure) => failure.includes("no pattern binding")))
    assert.ok(result.failures.some((failure) => failure.includes("does not exist")))
})

test("refuses changed content under an old plan hash", () => {
    const { root, plan } = fixture()
    plan.objective = "different operation"
    assert.equal(checkPlan(plan, { patternRoot: root }).ok, false)
})
