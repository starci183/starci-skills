import assert from "node:assert/strict"
import test from "node:test"
import { checkRole, parseGateRouter } from "./check.mjs"

const router = `
| Emitted rule | Situation | Trigger | Load |
|---|---|---|---|
| \`first-rule\` | LAW-1 | first refusal | \`one/context.md\` |
| \`second-rule\` | LAW-2 / TEST-1 | second refusal | \`two/context.md\` and \`shared/context.md\` |
`

test("gate router parser retains rule identity, situations and every target", () => {
    assert.deepEqual(parseGateRouter(router), [
        {
            rule: "first-rule",
            situation: "LAW-1",
            trigger: "first refusal",
            loads: ["one/context.md"],
        },
        {
            rule: "second-rule",
            situation: "LAW-2 / TEST-1",
            trigger: "second refusal",
            loads: ["two/context.md", "shared/context.md"],
        },
    ])
})

test("accountability check refuses a published rule with no gate route", async () => {
    const result = await checkRole("be", {
        packageEntry: import.meta.url,
        plugin: {
            rules: { "machine-only-rule": {} },
            ruleOwners: { "machine-only-rule": "law" },
        },
    })
    assert.equal(result.ok, false)
    assert.ok(result.failures.some((failure) => failure.includes("published machine rule has no gate route")))
})

test("accountability check refuses a gate route missing from the package", async () => {
    const result = await checkRole("be", {
        packageEntry: import.meta.url,
        plugin: { rules: {}, ruleOwners: {} },
    })
    assert.equal(result.ok, false)
    assert.ok(result.failures.some((failure) => failure.includes("gate route has no published machine rule")))
})
