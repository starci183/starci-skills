import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import test from "node:test"
import plugin from "./index.mjs"
import { pluginForEdition } from "./lib/edition.mjs"
import { enforcerJudgedInEdition } from "./runtime/scripts/hfs/edition-slots.mjs"
import { loadRuleCatalog } from "./runtime/scripts/hfs/slots.mjs"

const RUNTIME = fileURLToPath(new URL("./runtime/", import.meta.url))
const catalog = loadRuleCatalog({ root: RUNTIME })

test("every published back-end rule follows the bundled catalog in both editions", () => {
    for (const edition of ["full", "lite"]) {
        const gated = pluginForEdition({ plugin, hfs: { edition }, catalog })
        for (const [id, rule] of Object.entries(plugin.rules)) {
            assert.equal(
                gated.rules[id] === rule,
                catalog.enforcerJudgedIn("eslint-be", id, edition),
                `${id} disagrees with knowledge/hfs/rules.yaml in ${edition}`,
            )
        }
    }
})

test("full keeps the exact plugin and every exact rule object", () => {
    const gated = pluginForEdition({ plugin, hfs: {} })
    assert.equal(gated, plugin)
    for (const [id, rule] of Object.entries(plugin.rules)) assert.equal(gated.rules[id], rule, id)
})

test("an uncatalogued lint rule runs in every edition", () => {
    const rule = Object.freeze({ meta: {}, create: () => ({ Program() {} }) })
    const extended = Object.freeze({ ...plugin, rules: Object.freeze({ ...plugin.rules, "future-law": rule }) })
    for (const edition of ["full", "lite"]) {
        const gated = pluginForEdition({ plugin: extended, hfs: { edition }, catalog })
        assert.equal(gated.rules["future-law"], rule)
    }
})

test("an enforcer shared by two catalog rules runs only where both owners are judged", () => {
    const rule = Object.freeze({ meta: {}, create: () => ({ Program() {} }) })
    const shared = Object.freeze({ rules: Object.freeze({ shared: rule }) })
    const rules = [
        { editions: ["full", "lite"], enforcers: [{ kind: "eslint-be", id: "shared" }] },
        { editions: ["full"], enforcers: [{ kind: "eslint-be", id: "shared" }] },
    ]
    const twoOwnerCatalog = {
        enforcerJudgedIn: (kind, id, edition) => enforcerJudgedInEdition(rules, kind, id, edition),
    }

    assert.equal(pluginForEdition({ plugin: shared, hfs: { edition: "full" }, catalog: twoOwnerCatalog }).rules.shared, rule)
    assert.deepEqual(pluginForEdition({ plugin: shared, hfs: { edition: "lite" }, catalog: twoOwnerCatalog }).rules.shared.create(), {})
})

test("unknown and null editions are refused before catalog filtering", () => {
    for (const edition of ["enterprise", "", null]) {
        assert.throws(() => pluginForEdition({ plugin, hfs: { edition }, catalog }), /Unknown HFS edition/u)
    }
})
