import assert from "node:assert/strict"
import test from "node:test"
import { checkWorkflows, parseSkillRoutes } from "./check.mjs"

test("parser finds only physical skill bindings", () => {
    assert.deepEqual(parseSkillRoutes("| x | `skills/a/SKILL.md` |\n| y | `runtime/standards/x/context.md` |"), [
        "skills/a/SKILL.md",
    ])
})

test("workflow parity accepts one owner per skill", () => {
    const result = checkWorkflows({
        physicalSkills: ["skills/a/SKILL.md", "skills/b/SKILL.md"],
        contexts: [{ path: "runtime/workflows/x/context.md", text: "`skills/a/SKILL.md` `skills/b/SKILL.md`" }],
    })
    assert.equal(result.ok, true)
})

test("workflow parity refuses duplicate and absent owners", () => {
    const result = checkWorkflows({
        physicalSkills: ["skills/a/SKILL.md", "skills/b/SKILL.md"],
        contexts: [
            { path: "runtime/workflows/x/context.md", text: "`skills/a/SKILL.md`" },
            { path: "runtime/workflows/y/context.md", text: "`skills/a/SKILL.md` `skills/c/SKILL.md`" },
        ],
    })
    assert.equal(result.ok, false)
    assert.ok(result.failures.some((failure) => failure.includes("multiple workflow owners")))
    assert.ok(result.failures.some((failure) => failure.includes("no workflow owner")))
    assert.ok(result.failures.some((failure) => failure.includes("missing skill target")))
})
