/**
 * Twin tests for the gathered plugin.
 *
 *   node --test index.test.mjs
 *
 * The failures worth catching here are the ones a build never reports: two laws publishing one
 * rule name, where whichever imports last silently wins; and a rule that exists but is absent from
 * the recommended set, which reaches a consuming repository switched off and looks adopted.
 */
import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
import test from "node:test"
import plugin, { audits, lawOwners, linterOptions, recommended, ruleDeclarations, ruleOwners, rules } from "./index.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))

/** Every rule module in this axis, by law name. */
const lawModules = () =>
  readdirSync(HERE)
    .filter((name) => name.endsWith(".mjs") && !name.endsWith(".test.mjs") && name !== "index.mjs")
    .map((name) => name.replace(/\.mjs$/, ""))
    .sort()

test("every law in the folder is gathered - a new module cannot be forgotten here", async () => {
  const gathered = [...new Set(lawOwners)].sort()
  assert.deepEqual(
    gathered,
    lawModules(),
    "a rule module exists that this file does not import, so its rules ship as a document",
  )
})

test("repository audits are gathered with the plugin laws", () => {
  assert.equal(typeof audits["effective-config"], "function")
})

/*
 * Walk the DECLARATIONS, never the gathered map. Reading `ruleOwners` here would mean reading a map
 * whose duplicates were already discarded, so the check could never fail - which is how the
 * back-end twin passed for its whole life while three collided rules shipped underneath it.
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
 * The arithmetic the name check cannot do for itself: a discarded declaration makes these two counts
 * disagree, whatever the reason it was discarded.
 */
test("every declared rule survives into the published set", () => {
  assert.equal(
    ruleDeclarations.length,
    Object.keys(rules).length,
    "a declared rule was discarded while gathering; the laws declare more rules than the plugin ships",
  )
})

test("every published rule is in the recommended set", () => {
  const missing = Object.keys(rules).filter((name) => recommended[`starci-fe/${name}`] === undefined)
  assert.deepEqual(
    missing,
    [],
    `these rules exist but ask for no level: ${missing.join(", ")} - they would reach a repository switched off while looking adopted`,
  )
})

test("every FE canon rule is strict - no warn or off rollout", () => {
  const loose = Object.entries(recommended).filter(([, level]) => level !== "error")
  assert.deepEqual(loose, [], "FE canon contains a rule that is not an error")
})

test("the gathered config refuses inline lint directives", () => {
  assert.deepEqual(linterOptions, { noInlineConfig: true })
})

test("every rule is a rule, and the plugin exposes them all", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
    assert.equal(plugin.rules[name], rule, `${name} is missing from the plugin object`)
  }
})
