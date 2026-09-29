/**
 * Twin tests for the back-end config factory.
 *
 *   node --test config.test.mjs
 *
 * The failures worth catching: the retired list drifting from the manifest that expects those rules
 * off (a rule then either ships off unrecorded, or the manifest guard fails on a repository that
 * followed the canon), a repository block that ends up with no rules and lints green, and a `warn`
 * that survives into a zero-warning gate.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { parseYaml } from "../../../engine/yaml.mjs"
import plugin, { RETIRED, linterOptions, recommended, starciBeConfig } from "./index.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCES = ["apps/**/*.ts", "src/**/*.ts"]

/** Every rule id the manifest guards with `expected: { severity: off }`. */
const manifestOffRules = () => {
    const manifest = parseYaml(readFileSync(join(HERE, "..", "..", "..", "modules", "models", "code-patterns.yaml"), "utf8"))
    const found = new Set()
    const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk)
        if (!node || typeof node !== "object") return
        const check = node.check
        if (check?.kind === "eslint" && check.expected?.severity === "off") {
            for (const id of check.ruleIds ?? []) if (id.startsWith("starci-be/")) found.add(id)
        }
        Object.values(node).forEach(walk)
    }
    walk(manifest)
    return [...found].sort()
}

test("the retired list is exactly the set the code-pattern manifest expects off", () => {
    assert.deepEqual(Object.keys(RETIRED).sort(), manifestOffRules())
})

test("every retired rule exists in the recommendation", () => {
    for (const name of Object.keys(RETIRED)) assert.ok(name in recommended, `${name} is retired but not published`)
})

test("the block carries every recommended rule, the retired ones off and the rest at error", () => {
    const block = starciBeConfig({ sources: SOURCES, plugin, recommended })
    assert.deepEqual(block.files, SOURCES)
    assert.deepEqual(Object.keys(block.rules).sort(), Object.keys(recommended).sort())
    for (const [name, setting] of Object.entries(block.rules)) {
        if (name in RETIRED) assert.equal(setting, "off", name)
        else assert.notEqual(Array.isArray(setting) ? setting[0] : setting, "warn", `${name} keeps warn in a zero-warning gate`)
    }
    assert.equal(block.plugins["starci-be"], plugin)
    assert.deepEqual(block.linterOptions, linterOptions)
})

test("a warn with options stays configured and becomes error", () => {
    const block = starciBeConfig({
        sources: SOURCES,
        plugin,
        recommended: { ...recommended, "starci-be/probe": ["warn", { max: 3 }] },
    })
    assert.deepEqual(block.rules["starci-be/probe"], ["error", { max: 3 }])
})

test("an empty recommendation or empty sources is refused, never a silent empty block", () => {
    assert.throws(() => starciBeConfig({ sources: SOURCES, plugin, recommended: {} }), /empty recommendation/)
    assert.throws(() => starciBeConfig({ sources: SOURCES, plugin, recommended: undefined }), /empty recommendation/)
    assert.throws(() => starciBeConfig({ sources: [], plugin, recommended }), /source globs/)
})

test("a recommendation missing a retired rule is refused", () => {
    const { "starci-be/no-folder-reexport": _dropped, ...rest } = recommended
    assert.throws(() => starciBeConfig({ sources: SOURCES, plugin, recommended: rest }), /no-folder-reexport/)
})
