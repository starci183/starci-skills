/**
 * Twin tests for the `starciFeConfig` factory and the Vietnamese why map.
 *
 *   node --test config.test.mjs
 *
 * The failure this file exists to catch is the silent one: a factory that returns a block with a
 * rule missing, or at `warn`, or `off`, lints clean and is indistinguishable from adoption.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { ESLint } from "eslint"
import tsParser from "@typescript-eslint/parser"
import plugin, {
  LAYOUTS,
  e2eRecommended,
  linterOptions,
  reactHooksRules,
  recommended,
  ruleOwners,
  rules,
  sourceRecommended,
  starciFeConfig,
  why,
} from "./index.mjs"

const single = starciFeConfig({ layout: "single-app" })

test("the factory returns a source block and an e2e block, and states its layouts", () => {
  assert.deepEqual([...LAYOUTS].sort(), ["monorepo", "single-app"])
  assert.equal(single.length, 2)
  assert.deepEqual(single[0].files, ["src/**/*.{ts,tsx}", "**/candidate/src/**/*.{ts,tsx}"])
  assert.ok(single[1].files.includes("e2e/**/*.{ts,tsx}"))
  assert.ok(single[1].files.some((glob) => glob.startsWith("playwright.config")))
  const mono = starciFeConfig({ layout: "monorepo" })
  assert.ok(mono[0].files.includes("apps/*/src/**/*.{ts,tsx}"))
  assert.ok(mono[1].files.includes("apps/*/e2e/**/*.{ts,tsx}"))
  assert.throws(() => starciFeConfig({ layout: "nope" }), /unknown layout/)
  assert.throws(() => starciFeConfig(), /unknown layout/)
})

test("every published rule is enabled at error - no rule is off, none is a warning", () => {
  const enabled = { ...single[0].rules, ...single[1].rules }
  for (const name of Object.keys(rules)) {
    assert.equal(enabled[`starci-fe/${name}`], "error", `starci-fe/${name} is not an error in the factory's blocks`)
  }
})

test("no rule in either block is off, warn or a numeric level below error", () => {
  for (const block of single) {
    for (const [name, level] of Object.entries(block.rules)) {
      assert.equal(level, "error", `${name} is ${JSON.stringify(level)}`)
    }
  }
})

test("the source block carries the source rules and the hooks rules; the e2e block carries the e2e rules", () => {
  for (const name of Object.keys(sourceRecommended)) assert.equal(single[0].rules[name], "error")
  for (const name of Object.keys(e2eRecommended)) {
    assert.equal(single[1].rules[name], "error")
    assert.equal(single[0].rules[name], undefined, `${name} governs e2e only and must not reach src`)
  }
  assert.equal(single[1].rules["starci-fe/no-inline-lint-config"], "error")
  assert.deepEqual(
    Object.keys(recommended).sort(),
    [...Object.keys(sourceRecommended), ...Object.keys(e2eRecommended)].sort(),
    "recommended is the union of the two trees",
  )
})

test("the React Hooks rules are on, including the effect and ref rules, all at error", () => {
  for (const name of [
    "react-hooks/rules-of-hooks",
    "react-hooks/exhaustive-deps",
    "react-hooks/set-state-in-effect",
    "react-hooks/refs",
    "react-hooks/purity",
    "react-hooks/immutability",
  ]) {
    assert.equal(single[0].rules[name], "error", `${name} is not an error`)
  }
  const hooks = Object.entries(single[0].rules).filter(([name]) => name.startsWith("react-hooks/"))
  assert.ok(hooks.length >= 10, "the recommended hooks set was not carried over")
  assert.deepEqual(hooks.filter(([, level]) => level !== "error"), [])
  assert.ok(single[0].plugins["react-hooks"], "the block does not register the react-hooks plugin")
})

test("a hooks plugin too old to carry the effect and ref rules is refused, not adopted", () => {
  const old = { configs: { flat: { recommended: { rules: { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "warn" } } } } }
  assert.throws(() => reactHooksRules(old), /set-state-in-effect/)
  assert.throws(() => reactHooksRules({}), /set-state-in-effect/)
})

test("the blocks refuse inline directives and register the canon plugin", () => {
  for (const block of single) {
    assert.deepEqual(block.linterOptions, { noInlineConfig: true, reportUnusedDisableDirectives: "error" })
    assert.equal(block.plugins["starci-fe"], plugin)
  }
  assert.notEqual(single[0].linterOptions, linterOptions, "the block copies the frozen options rather than sharing them")
})

test("the factory's config lints a real file: a hardcoded copy string is an error", async () => {
  const eslint = new ESLint({
    cwd: process.cwd(),
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.tsx"],
        languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
      },
      { ...single[0], files: ["**/*.tsx"] },
    ],
  })
  const [result] = await eslint.lintText("export const E = () => <p>Nothing to show yet</p>\n", {
    filePath: `${process.cwd()}/src/components/blocks/Feed/index.tsx`,
  })
  const rule = result.messages.find((message) => message.ruleId === "starci-fe/no-hardcoded-copy")
  assert.ok(rule, `no-hardcoded-copy did not report: ${JSON.stringify(result.messages.map((m) => m.ruleId))}`)
  assert.equal(rule.severity, 2)
})

// -- the why map -----------------------------------------------------------------------------------

/** Laws whose every rule carries a catalogue code, and so a Vietnamese why. */
const CATALOGUED_LAWS = [
  "env-owner",
  "transport",
  "client-boundary",
  "hooks-folder",
  "next-conventions",
  "brand-values",
  "native-controls",
  "size-and-state-budget",
  "e2e-shape",
  "spec-quality",
  "lint-escape-hatch",
]
/** The rules of laws that mix catalogued and older rules. */
const CATALOGUED_RULES = ["no-hardcoded-copy"]

test("every catalogued rule has a why with a code, a Vietnamese headline and a Vietnamese next step", () => {
  const needed = Object.entries(ruleOwners)
    .filter(([name, law]) => CATALOGUED_LAWS.includes(law) || CATALOGUED_RULES.includes(name))
    .map(([name]) => name)
  assert.ok(needed.length >= 30, `only ${needed.length} catalogued rules found`)
  const vietnamese = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i
  for (const name of needed) {
    const entry = why[name]
    assert.ok(entry, `${name} has no why`)
    assert.match(entry.code, /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/, `${name}: code is not UPPER_SNAKE`)
    assert.match(entry.vi, vietnamese, `${name}: vi is not Vietnamese`)
    assert.match(entry.fixVi, vietnamese, `${name}: fixVi is not Vietnamese`)
  }
})

test("no why names a rule that does not exist", () => {
  const orphans = Object.keys(why).filter((name) => !(name in rules))
  assert.deepEqual(orphans, [])
})

test("the codes are the catalogue's codes for R18, R49-R52, R55, R56, R58, R60-R62, R65-R67", () => {
  const codes = new Set(Object.values(why).map((entry) => entry.code))
  for (const code of [
    "FE_ENV_OWNER",
    "FE_TRANSPORT_OWNER",
    "FE_HTTP_STATUS_COLLAPSE",
    "FE_WIRE_GENERATED",
    "FE_CLIENT_BOUNDARY",
    "FE_HOOKS_ARE_HOOKS",
    "FE_I18N_LITERAL",
    "FE_STYLE_TOKEN_ONLY",
    "FE_NATIVE_FORM_CONTROL",
    "FE_SIZE_AND_STATE_BUDGET",
    "FE_E2E_SHAPE",
    "FE_SPEC_QUALITY",
    "HFS_INLINE_SUPPRESSION",
  ]) {
    assert.ok(codes.has(code), `no rule reports under ${code}`)
  }
})
