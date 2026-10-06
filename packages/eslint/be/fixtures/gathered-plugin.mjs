/**
 * The shared spec of a gathered canon plugin (be and fe index.spec.mjs run it against their own ./index.mjs):
 * the shape a law folder's index must keep whatever the side. A side prefixes every title with its name so the
 * two runs stay distinguishable.
 *
 * The failures worth catching are the ones a build never reports: a law module nobody imported, whose rules
 * then ship as a document; two laws publishing one rule name, where whichever imports last silently wins; and
 * a rule absent from the recommended set, which reaches a consuming repository switched off while looking
 * adopted.
 */
import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import test from "node:test"

/** The order `.sort()` gives without a compare function (UTF-16 code units), spelt out. */
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/** Register the gathered-plugin contract against one side's index.mjs. */
export function gatheredPluginSpec({ side, dir, plugin, lawOwners, recommended, ruleDeclarations, rules }) {
  const namespace = `starci-${side}`

  /** Every rule module in this axis, by law name. */
  const lawModules = () =>
    readdirSync(dir)
      .filter((name) => name.endsWith(".mjs") && !name.endsWith(".spec.mjs") && name !== "index.mjs")
      .map((name) => name.replace(/\.mjs$/, ""))
      .sort(byCodeUnit)

  test(`${side}: every law in the folder is gathered - a new module cannot be forgotten here`, () => {
    const gathered = [...new Set(lawOwners)].sort(byCodeUnit)
    assert.deepEqual(
      gathered,
      lawModules(),
      "a rule module exists that this file does not import, so its rules ship as a document",
    )
  })

  /*
   * Walk the DECLARATIONS, never the gathered map. Reading `ruleOwners` here would mean reading a map
   * whose duplicates were already discarded, so the check could never fail - which is how the
   * back-end twin passed for its whole life while three collided rules shipped underneath it.
   */
  test(`${side}: no two laws publish the same rule name`, () => {
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
  test(`${side}: every declared rule survives into the published set`, () => {
    assert.equal(
      ruleDeclarations.length,
      Object.keys(rules).length,
      "a declared rule was discarded while gathering; the laws declare more rules than the plugin ships",
    )
  })

  test(`${side}: every published rule is in the recommended set`, () => {
    const missing = Object.keys(rules).filter((name) => recommended[`${namespace}/${name}`] === undefined)
    assert.deepEqual(
      missing,
      [],
      `these rules exist but ask for no level: ${missing.join(", ")} - they would reach a repository switched off while looking adopted`,
    )
  })

  test(`${side}: every rule is a rule, and the plugin exposes them all`, () => {
    for (const [name, rule] of Object.entries(rules)) {
      assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
      assert.equal(plugin.rules[name], rule, `${name} is missing from the plugin object`)
    }
  })
}
