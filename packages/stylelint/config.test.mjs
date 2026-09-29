/**
 * Twin tests for the `starciStylelintConfig` factory (no rule is off) and the Vietnamese why map.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { assertEveryRuleOn, plugins, ruleNames, rules, starciStylelintConfig, why } from "./index.mjs"
import { FILES, lint } from "./testing.mjs"

test("the config runs every rule of the canon at error and ignores inline disables", () => {
  const config = starciStylelintConfig()
  assert.equal(ruleNames.length, Object.keys(rules).length)
  assert.equal(plugins.length, ruleNames.length)
  for (const name of ruleNames) {
    assert.ok(name.startsWith("starci/"), name)
    const entry = config.rules[name]
    assert.ok(entry === true || (Array.isArray(entry) && entry[0] === true), `${name} is not on`)
  }
  assert.equal(config.defaultSeverity, "error")
  assert.equal(config.ignoreDisables, true)
  assert.equal(config.ignoreFiles, undefined)
})

test("appTokens reach the two rules that read them, and no other", () => {
  const config = starciStylelintConfig({ appTokens: ["--page-ink"] })
  assert.deepEqual(config.rules["starci/token-only"], [true, { appTokens: ["--page-ink"] }])
  assert.deepEqual(config.rules["starci/no-apply-raw"], [true, { appTokens: ["--page-ink"] }])
  assert.equal(config.rules["starci/no-important"], true)
})

test("the factory has no switch: any option but appTokens throws", () => {
  assert.throws(() => starciStylelintConfig({ rules: { "starci/no-important": null } }), /no switch to turn a rule off/)
  assert.throws(() => starciStylelintConfig({ severity: "warning" }), /unknown option severity/)
  assert.throws(() => starciStylelintConfig({ ignoreFiles: ["**/*.css"] }), /unknown option ignoreFiles/)
})

test("appTokens must be custom-property names outside the grammar vocabulary", () => {
  assert.throws(() => starciStylelintConfig({ appTokens: ["page-ink"] }), /not a custom property name/)
  assert.throws(() => starciStylelintConfig({ appTokens: ["--accent"] }), /grammar token/)
  assert.throws(() => starciStylelintConfig({ appTokens: ["--grammar-anything"] }), /grammar token/)
})

test("assertEveryRuleOn refuses a rule that is off, downgraded, missing or hidden", () => {
  const good = () => starciStylelintConfig()
  const off = (mutate) => {
    const config = good()
    mutate(config)
    return config
  }
  assert.throws(() => assertEveryRuleOn(off((config) => (config.rules["starci/no-important"] = null))), /no-important is off/)
  assert.throws(() => assertEveryRuleOn(off((config) => (config.rules["starci/token-only"] = false))), /token-only is off/)
  assert.throws(
    () => assertEveryRuleOn(off((config) => (config.rules["starci/globals-shape"] = [true, { severity: "warning" }]))),
    /globals-shape is off or downgraded/,
  )
  assert.throws(() => assertEveryRuleOn(off((config) => delete config.rules["starci/raw-brand-value"])), /raw-brand-value is missing/)
  assert.throws(() => assertEveryRuleOn(off((config) => (config.defaultSeverity = "warning"))), /defaultSeverity/)
  assert.throws(() => assertEveryRuleOn(off((config) => (config.ignoreDisables = false))), /ignoreDisables/)
  assert.throws(() => assertEveryRuleOn(off((config) => (config.ignoreFiles = ["a.css"]))), /ignoreFiles/)
  assert.throws(
    () => assertEveryRuleOn(off((config) => (config.overrides = [{ files: ["**/*.module.css"], rules: { "starci/no-important": null } }]))),
    /off or downgraded in overrides\[0\]/,
  )
  assert.doesNotThrow(() => assertEveryRuleOn(good()))
})

test("the config lints a clean stylesheet with no finding and no unknown-rule error", async () => {
  assert.deepEqual(await lint('[data-state="open"] { color: var(--accent); padding: var(--grammar-inline-gap); }', FILES.css), [])
})

test("every rule fires through the factory config on a stylesheet that breaks it", async () => {
  const fired = new Set()
  const cases = [
    [".a { color: white; }", undefined],
    [".a { width: 4px; }", undefined],
    [".a { @apply w-[4px]; }", undefined],
    [".a { color: var(--accent) !important; }", undefined],
    [".a { color: var(--accent); }", "D:/repo/src/app/globals.css"],
    [".a { --accent: var(--muted); }", undefined],
    [":root { --accent: #fff; }", "D:/repo/src/modules/brand/brand.css"],
    ["/* stylelint-disable */", undefined],
    [".a { color: var(--accent); }", FILES.css],
    ["@media (min-width: 500px) { [data-a] { color: var(--accent); } }", FILES.css],
    ["@source \"./nowhere-at-all\";", FILES.globals],
    ["@import \"other.css\";", FILES.globals],
  ]
  for (const [code, file] of cases) for (const warning of await lint(code, file)) fired.add(warning.rule)
  assert.deepEqual([...fired].sort(), [...ruleNames].sort())
})

test("every rule has a why with a code, a Vietnamese headline and a Vietnamese next step", () => {
  const vietnamese = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i
  for (const name of Object.keys(rules)) {
    const entry = why[name]
    assert.ok(entry, `${name} has no why`)
    assert.match(entry.code, /^[A-Z][A-Z0-9_]+$/, `${name} code`)
    assert.match(entry.vi, vietnamese, `${name} vi is not Vietnamese`)
    assert.match(entry.vi, /<file>/, `${name} vi names no <file>`)
    assert.match(entry.fixVi, vietnamese, `${name} fixVi is not Vietnamese`)
  }
})

const CODES = { "no-inline-lint-config": "HFS_INLINE_SUPPRESSION", "source-resolves": "FE_STYLE_SOURCE_UNRESOLVED" }

test("no why names a rule that does not exist, and the rules share the R61 code except suppression and unresolved @source", () => {
  assert.deepEqual(Object.keys(why).sort(), Object.keys(rules).sort())
  for (const name of Object.keys(rules)) {
    assert.equal(why[name].code, CODES[name] ?? "FE_STYLE_TOKEN_ONLY", name)
  }
})
