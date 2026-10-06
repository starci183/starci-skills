/**
 * Twin tests for the gathered plugin.
 *
 *   node --test index.spec.mjs
 *
 * The failures worth catching here are the ones a build never reports: two laws publishing one
 * rule name, where whichever imports last silently wins; and a rule that exists but is absent from
 * the recommended set, which reaches a consuming repository switched off and looks adopted.
 * The shared contract lives in ../be/fixtures/gathered-plugin.mjs; what follows is the front end's own.
 */
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
import test from "node:test"
import plugin, { lawOwners, linterOptions, recommended, ruleDeclarations, ruleOwners, rules } from "./index.mjs"
import { gatheredPluginSpec } from "../be/fixtures/gathered-plugin.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))

gatheredPluginSpec({ side: "fe", dir: HERE, plugin, lawOwners, recommended, ruleDeclarations, rules })

test("fe: the plugin publishes rules only - no repository audit rides beside it", async () => {
  const module = await import("./index.mjs")
  assert.equal(module.audits, undefined, "the plugin exports rules only; the managed eslint.config.mjs carries the effective config (R17)")
  assert.equal(module.auditOwners, undefined)
})

test("fe: every FE canon rule is strict - no warn or off rollout", () => {
  const loose = Object.entries(recommended).filter(([, level]) => level !== "error")
  assert.deepEqual(loose, [], "FE canon contains a rule that is not an error")
})

test("fe: the gathered config refuses inline lint directives and reports dead ones", () => {
  assert.deepEqual(linterOptions, { noInlineConfig: true, reportUnusedDisableDirectives: "error" })
})

test("fe: the hardcoded-copy rule is published", () => {
  assert.equal(typeof rules["no-hardcoded-copy"]?.create, "function")
})
