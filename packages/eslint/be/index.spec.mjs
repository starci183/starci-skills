/**
 * Twin tests for the gathered back-end plugin.
 *
 *   node --test index.spec.mjs
 *
 * The failures worth catching here are the ones a build never reports: a law module nobody imported,
 * whose rules then ship as a document; two laws publishing one rule name, where whichever imports
 * last silently wins; and a rule absent from the recommended set, which reaches a consuming
 * repository switched off while looking adopted. The shared contract lives in
 * ./fixtures/gathered-plugin.mjs; what follows is the back end's own.
 */
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
import test from "node:test"
import plugin, { lawOwners, recommended, ruleDeclarations, ruleOwners, rules } from "./index.mjs"
import { gatheredPluginSpec } from "./fixtures/gathered-plugin.mjs"
import { pluginForEdition } from "./lib/edition.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))

gatheredPluginSpec({ side: "be", dir: HERE, plugin, lawOwners, recommended, ruleDeclarations, rules })

test("be: every level is one a linter understands", () => {
    // A law may ask for a stock rule WITH options - `["error", { ... }]` - so the level is the head
    // of the entry rather than the entry itself. Reading only the plain form reported those as
    // broken, which is the gate being wrong about a shape ESLint has always accepted.
    const levelOf = (entry) => (Array.isArray(entry) ? entry[0] : entry)
    const strange = Object.entries(recommended).filter(
        ([, entry]) => !["error", "warn", "off"].includes(levelOf(entry)),
    )
    assert.deepEqual(strange, [], "a level no linter accepts silently disables the rule it belongs to")
})

test("the generic edition gate disables a full-only catalog enforcer in lite and keeps it active in full", () => {
    const gated = "rest-door-needs-a-reason"
    const shared = "default-deny-guards"
    const catalog = { enforcerJudgedIn: (_kind, id, edition) => id !== gated || edition === "full" }

    const lite = pluginForEdition({ plugin, hfs: { edition: "lite" }, catalog })
    assert.deepEqual(lite.rules[gated].create(), {})
    assert.equal(lite.rules[shared], plugin.rules[shared])

    const full = pluginForEdition({ plugin, hfs: { edition: "full" }, catalog })
    assert.equal(full.rules[gated], plugin.rules[gated])
    assert.equal(full.rules[shared], plugin.rules[shared])
})
