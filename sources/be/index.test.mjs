/**
 * Twin tests for the gathered back-end plugin.
 *
 *   node --test index.test.mjs
 *
 * The failures worth catching here are the ones a build never reports: a law module nobody imported,
 * whose rules then ship as a document; two laws publishing one rule name, where whichever imports
 * last silently wins; and a rule absent from the recommended set, which reaches a consuming
 * repository switched off while looking adopted.
 */
import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
import test from "node:test"
import plugin, { lawOwners, recommended, ruleDeclarations, ruleOwners, rules } from "./index.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))

/** Every rule module in this axis, by law name. */
const lawModules = () =>
    readdirSync(HERE)
        .filter((name) => name.endsWith(".mjs") && !name.endsWith(".test.mjs") && name !== "index.mjs")
        .map((name) => name.replace(/\.mjs$/, ""))
        .sort()

test("every law in the folder is gathered - a new module cannot be forgotten here", () => {
    const gathered = [...new Set(lawOwners)].sort()
    assert.deepEqual(
        gathered,
        lawModules(),
        "a rule module exists that this file does not import, so its rules ship as a document",
    )
})

/*
 * WALK THE DECLARATIONS, NEVER THE GATHERED MAP.
 *
 * This test used to read `ruleOwners`, which is built with `Object.fromEntries` - so the duplicate
 * it was hunting had already been discarded before it looked. Every name appeared once by
 * construction, `owners.length > 1` could never be true, and the test passed for as long as it
 * existed while three real collisions shipped underneath it. `ruleDeclarations` is the raw list,
 * one entry per DECLARATION rather than per surviving name, so a second claim is still visible.
 */
test("no two laws publish the same rule name", () => {
    const counted = new Map()
    for (const { name, law } of ruleDeclarations) {
        counted.set(name, [...(counted.get(name) ?? []), law])
    }
    const clashes = [...counted.entries()].filter(([, owners]) => owners.length > 1)
    assert.deepEqual(clashes, [], "two laws claim one rule name; whichever imports last would win silently")
})

/*
 * The arithmetic check the name-collision test cannot make on its own: if any name were dropped,
 * the count of declarations and the count of shipped rules would disagree. It is cheap, it needs no
 * knowledge of which names collided, and it fails even if a future collision slips past the map
 * comparison above for a reason nobody predicted.
 */
test("every declared rule survives into the published set", () => {
    assert.equal(
        ruleDeclarations.length,
        Object.keys(rules).length,
        "a declared rule was discarded while gathering; the laws declare more rules than the plugin ships",
    )
})

test("every published rule is in the recommended set", () => {
    const missing = Object.keys(rules).filter((name) => recommended[`starci-be/${name}`] === undefined)
    assert.deepEqual(
        missing,
        [],
        `these rules exist but ask for no level: ${missing.join(", ")} - they would reach a repository switched off while looking adopted`,
    )
})

test("every level is one a linter understands", () => {
    // A law may ask for a stock rule WITH options - `["error", { ... }]` - so the level is the head
    // of the entry rather than the entry itself. Reading only the plain form reported those as
    // broken, which is the gate being wrong about a shape ESLint has always accepted.
    const levelOf = (entry) => (Array.isArray(entry) ? entry[0] : entry)
    const strange = Object.entries(recommended).filter(
        ([, entry]) => !["error", "warn", "off"].includes(levelOf(entry)),
    )
    assert.deepEqual(strange, [], "a level no linter accepts silently disables the rule it belongs to")
})

test("every rule is a rule, and the plugin exposes them all", () => {
    for (const [name, rule] of Object.entries(rules)) {
        assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
        assert.equal(plugin.rules[name], rule, `${name} is missing from the plugin object`)
    }
})
