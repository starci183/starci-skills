/**
 * Twin tests for the `starciFeConfig` factory and the why map.
 *
 *   node --test config.spec.mjs
 *
 * The failure this file exists to catch is the silent one: a factory that returns a block with a
 * rule missing, or at `warn`, or `off`, lints clean and is indistinguishable from adoption.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { ESLint, Linter } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import plugin, {
  linterOptions,
  reactHooksRules,
  recommended,
  ruleOwners,
  rules,
  starciFeConfig,
  starciPlainSourceConfig,
  starciTypedSourceConfig,
  why,
} from "./index.mjs"
import { BORROWED, PLAIN_SOURCE_FILES, SLOT_FREE_RULES } from "./lib/config.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { declaredHfsView } from "./runtime/scripts/hfs/view.mjs"
import { hasSecondLanguage } from "./runtime/scripts/lib/language.mjs"
import { appDeclaration } from "../be/fixtures/app.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "typed")
/** The files the typed fixture lints without listing them in its tsconfig; one list for every test, the project service is shared by root. */
const ALLOW_DEFAULT_PROJECT = ["apps/*/src/components/*/*/*.tsx", "src/*.ts", "src/*.tsx"]
const FE = appDeclaration("fe", { apps: [{ name: "web", kind: "next" }], optionalSlots: ["repo.packages", "fe.package.ui"] })
const hfs = hfsFromDeclaration(FE, ROOT)
const config = starciFeConfig({ hfs })
const [ignores, ...single] = config

test("the factory returns an ignore block, a typed source block and the Sonar way block, all from the HFS profile", () => {
  assert.equal(config.length, 3)
  assert.deepEqual(config[2].files, single[0].files, "the Sonar way block lints the same source")
  assert.ok(ignores.ignores.includes("**/__generated__/**"))
  assert.deepEqual(single[0].files, ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"])
  assert.ok(!single[0].files.some((glob) => glob.startsWith("packages/ui/")), "no package is named literally")
  assert.equal(single[0].languageOptions.parserOptions.projectService, true, "the source is linted with types")
  assert.equal(single[0].languageOptions.parserOptions.tsconfigRootDir, ROOT)
  assert.equal(single[0].settings.starci.hfs, hfs, "every rule reads the slot view")
  assert.throws(() => starciFeConfig({}), /loadHfs/)
  assert.throws(() => starciFeConfig(), /loadHfs/)
  const be = declaredHfsView({ runtimeRoot: join(dirname(fileURLToPath(import.meta.url)), "runtime"), declaration: FE, repoRoot: ROOT, side: "be" })
  assert.throws(() => starciFeConfig({ hfs: be }), /this view is the be side/)
})

test("every published rule is enabled at error - no rule is off, none is a warning", () => {
  const enabled = single[0].rules
  for (const name of Object.keys(rules)) {
    assert.equal(enabled[`starci-fe/${name}`], "error", `starci-fe/${name} is not an error in the factory's blocks`)
  }
})

test("no rule in either block is off, warn or a numeric level below error", () => {
  for (const block of single) {
    for (const [name, setting] of Object.entries(block.rules)) {
      const level = Array.isArray(setting) ? setting[0] : setting
      assert.equal(level, "error", `${name} is ${JSON.stringify(setting)}`)
    }
  }
})

test("the source block carries every published rule and the hooks rules", () => {
  for (const name of Object.keys(recommended)) assert.equal(single[0].rules[name], "error")
  assert.deepEqual(Object.keys(recommended).sort(), Object.keys(single[0].rules).filter((name) => name.startsWith("starci-fe/")).sort(), "the block holds the canon rules and nothing else of the plugin")
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

test("the source block refuses inline directives and registers the canon plugin", () => {
  for (const block of single.slice(0, 1)) {
    assert.deepEqual(block.linterOptions, { noInlineConfig: true, reportUnusedDisableDirectives: "error" })
    assert.equal(block.plugins["starci-fe"], plugin)
  }
  assert.notEqual(single[0].linterOptions, linterOptions, "the block copies the frozen options rather than sharing them")
})

test("the factory's config lints a real file: a hardcoded copy string is an error", async () => {
  // The factory's own block and the rule's own entry in it, linted from its tsconfigRootDir (the fixture side). The file need not
  // exist: the project service types it with the fixture's tsconfig.json as the default project, as the typed rule tester does.
  // The machine-backed rules of the block read the side from disk and are proven by the project-graph specs, not here.
  const [block] = single
  const RULE = "starci-fe/no-hardcoded-copy"
  const parserOptions = {
    ...block.languageOptions.parserOptions,
    projectService: { allowDefaultProject: ALLOW_DEFAULT_PROJECT, defaultProject: "tsconfig.json" },
  }
  const eslint = new ESLint({
    cwd: ROOT,
    overrideConfigFile: true,
    overrideConfig: [{ ...block, rules: { [RULE]: block.rules[RULE] }, languageOptions: { ...block.languageOptions, parserOptions } }],
  })
  const [result] = await eslint.lintText("export const E = () => <p>Nothing to show yet</p>\n", {
    filePath: join(ROOT, "apps", "web", "src", "components", "blocks", "Feed", "index.tsx"),
  })
  assert.deepEqual(result.messages.filter((message) => message.fatal), [], "the file parses with types")
  const rule = result.messages.find((message) => message.ruleId === RULE)
  assert.ok(rule, `no-hardcoded-copy did not report: ${JSON.stringify(result.messages.map((m) => m.ruleId))}`)
  assert.equal(rule.severity, 2)
})

const TYPE_AWARE = [
  "@typescript-eslint/no-floating-promises",
  "@typescript-eslint/no-misused-promises",
  "@typescript-eslint/switch-exhaustiveness-check",
  "@typescript-eslint/no-unsafe-assignment",
  "@typescript-eslint/no-unsafe-member-access",
  "@typescript-eslint/no-unsafe-call",
  "@typescript-eslint/no-unsafe-return",
  "@typescript-eslint/no-unsafe-argument",
]

test("the front end borrows the same type-aware promise, exhaustiveness and no-unsafe rules the back end does, all at error", () => {
  for (const name of TYPE_AWARE) {
    assert.equal(BORROWED[name], "error", `${name} is not borrowed at error`)
    assert.equal(single[0].rules[name], "error", `${name} is not in the source block`)
  }
})

test("a floating promise, an async handler passed where a void is expected and an unsound any are refused in front-end source", async () => {
  const [block] = single
  const parserOptions = {
    ...block.languageOptions.parserOptions,
    projectService: { allowDefaultProject: ALLOW_DEFAULT_PROJECT, defaultProject: "tsconfig.json" },
  }
  const eslint = new ESLint({
    cwd: ROOT,
    overrideConfigFile: true,
    overrideConfig: [{ ...block, rules: Object.fromEntries(TYPE_AWARE.map((name) => [name, "error"])), languageOptions: { ...block.languageOptions, parserOptions } }],
  })
  const source = [
    "declare const load: () => Promise<string>",
    "declare const raw: any",
    "export const run = (): void => { load() }",
    "export const handlers = [1].map(async () => 1).every(Boolean)",
    "export const name: string = raw.name",
    "",
  ].join("\n")
  const [result] = await eslint.lintText(source, { filePath: join(ROOT, "apps", "web", "src", "components", "blocks", "Feed", "index.tsx") })
  assert.deepEqual(result.messages.filter((message) => message.fatal), [], "the file parses with types")
  const ids = new Set(result.messages.map((message) => message.ruleId))
  for (const name of ["@typescript-eslint/no-floating-promises", "@typescript-eslint/no-unsafe-member-access", "@typescript-eslint/no-unsafe-assignment"]) assert.ok(ids.has(name), `${name} did not report: ${[...ids].join(", ")}`)
})

// -- a front-end tree that is no HFS app (a runtime package, the harness UI) ---------------------------------

const plain = starciPlainSourceConfig({ root: ROOT })

test("the plain-source config is typed, fenced and at error: no rule is off, warn or overridable", () => {
  assert.equal(plain.length, 3)
  assert.deepEqual(plain[1].files, [...PLAIN_SOURCE_FILES])
  assert.equal(plain[1].languageOptions.parserOptions.tsconfigRootDir, ROOT)
  assert.equal(plain[1].languageOptions.parserOptions.projectService, true)
  assert.deepEqual(plain[1].linterOptions, { noInlineConfig: true, reportUnusedDisableDirectives: "error" })
  for (const block of plain.slice(1)) for (const [name, setting] of Object.entries(block.rules)) assert.equal(Array.isArray(setting) ? setting[0] : setting, "error", name)
  for (const name of TYPE_AWARE) assert.equal(plain[1].rules[name], "error", name)
  for (const name of SLOT_FREE_RULES) assert.equal(plain[1].rules[`starci-fe/${name}`], "error", name)
  assert.equal(plain[1].rules["react-hooks/rules-of-hooks"], "error")
  assert.equal(plain[2].rules["unicorn/prefer-top-level-await"]?.[0], "error")
  assert.throws(() => starciPlainSourceConfig(), /needs { root }/)
})

test("the typed-source config is the plain one without the canon's own rules: types, hooks and Sonar way, all at error", () => {
  const typed = starciTypedSourceConfig({ root: ROOT })
  assert.equal(typed.length, 3)
  assert.deepEqual(Object.keys(typed[1].rules).filter((name) => name.startsWith("starci-fe/")), [])
  for (const name of TYPE_AWARE) assert.equal(typed[1].rules[name], "error", name)
  assert.equal(typed[1].rules["react-hooks/exhaustive-deps"], "error")
  assert.deepEqual(typed[2].rules, plain[2].rules)
  assert.deepEqual(typed[1].linterOptions, { noInlineConfig: true, reportUnusedDisableDirectives: "error" })
})

test("the slot-free list is closed: every other canon rule refuses to run without an HFS view, and every listed rule runs without one", () => {
  const linter = new Linter({ configType: "flat" })
  const parserOptions = { ...plain[1].languageOptions.parserOptions, projectService: { allowDefaultProject: ALLOW_DEFAULT_PROJECT, defaultProject: "tsconfig.json" } }
  const verify = (name) => linter.verify("export const x = 1\n", [{ files: ["**/*.ts"], languageOptions: { parser: tsParser, parserOptions }, plugins: { "starci-fe": plugin }, rules: { [`starci-fe/${name}`]: "error" } }], { filename: join(ROOT, "src", "a.ts") })
  const free = new Set(SLOT_FREE_RULES)
  for (const name of free) assert.ok(name in rules, `${name} is a published rule`)
  for (const name of Object.keys(rules)) {
    if (free.has(name)) {
      assert.deepEqual(verify(name).filter((message) => message.fatal), [], `${name} runs without a slot view`)
    } else {
      assert.throws(() => verify(name), /settings.starci.hfs/, `${name} needs a slot view, or is missing from SLOT_FREE_RULES`)
    }
  }
})

test("the plain-source config refuses a floating promise and a bare button in a tree with no slots", async () => {
  const [, block] = plain
  const parserOptions = { ...block.languageOptions.parserOptions, projectService: { allowDefaultProject: ALLOW_DEFAULT_PROJECT, defaultProject: "tsconfig.json" } }
  const eslint = new ESLint({ cwd: ROOT, overrideConfigFile: true, overrideConfig: [{ ...block, languageOptions: { ...block.languageOptions, parserOptions } }] })
  const source = ["declare const load: () => Promise<string>", "export const run = (): void => { load() }", "export const View = () => <button type=\"button\">x</button>", ""].join("\n")
  const [result] = await eslint.lintText(source, { filePath: join(ROOT, "src", "plain.tsx") })
  assert.deepEqual(result.messages.filter((message) => message.fatal), [])
  const ids = new Set(result.messages.map((message) => message.ruleId))
  assert.ok(ids.has("@typescript-eslint/no-floating-promises"), [...ids].join(", "))
  assert.ok(ids.has("starci-fe/no-native-form-control"), [...ids].join(", "))
})

// -- the why map -----------------------------------------------------------------------------------

/** Laws whose every rule carries a catalogue code, and so a why. */
const CATALOGUED_LAWS = [
  "env-owner",
  "fe-stack",
  "transport",
  "client-boundary",
  "hooks-folder",
  "next-conventions",
  "brand-values",
  "native-controls",
  "size-and-state-budget",
  "lint-escape-hatch",
  "type-safety",
  "lists",
  "hygiene",
  "formatting",
]
/** The rules of laws that mix catalogued and older rules. */
const CATALOGUED_RULES = [
  "no-hardcoded-copy",
  "page-exports-metadata",
  "no-null-suspense-fallback",
  "navigation-from-intl",
  "no-native-anchor",
  "no-hardcoded-route",
  "no-native-img",
  "image-has-size",
  "outcome-kinds-exhaustive",
]

test("every catalogued rule has a why with a code, an English headline and an English next step", () => {
  const needed = Object.entries(ruleOwners)
    .filter(([name, law]) => CATALOGUED_LAWS.includes(law) || CATALOGUED_RULES.includes(name))
    .map(([name]) => name)
  assert.ok(needed.length >= 30, `only ${needed.length} catalogued rules found`)
  for (const name of needed) {
    const entry = why[name]
    assert.ok(entry, `${name} has no why`)
    assert.match(entry.code, /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/, `${name}: code is not UPPER_SNAKE`)
    assert.ok(entry.en?.length > 0, `${name}: en is empty`)
    assert.ok(!hasSecondLanguage(entry.en), `${name}: en is not English`)
    assert.ok(entry.fix?.length > 0, `${name}: fix is empty`)
    assert.ok(!hasSecondLanguage(entry.fix), `${name}: fix is not English`)
  }
})

test("no why names a rule that does not exist", () => {
  const orphans = Object.keys(why).filter((name) => !(name in rules))
  assert.deepEqual(orphans, [])
})

test("the codes are the catalogue's codes for R18, R22, R49-R52, R55, R56, R58, R60-R62, R65 and the fe-stack catalog", () => {
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
    "HFS_INLINE_SUPPRESSION",
    "FE_TYPE_ESCAPE",
    "FE_LIST_KEY",
    "FE_EFFECT_CLEANUP",
    "FE_EFFECT_FETCH",
    "FE_SWALLOWED_ERROR",
    "FE_CONSOLE_CALL",
    "FE_PAGE_METADATA_MISSING",
    "FE_SUSPENSE_NULL_FALLBACK",
    "FE_I18N_NAVIGATION",
    "FE_I18N_FORMATTER",
    "FE_ROUTE_HARDCODED",
    "FE_CLIENT_SERVER_IMPORT",
    "FE_STORAGE_OUTSIDE_MODULES",
    "FE_DANGEROUS_HTML",
    "FE_NATIVE_IMAGE",
    "FE_OUTCOME_KIND_UNHANDLED",
    "FE_STACK_FORBIDDEN",
    "FE_SERVER_ACTION_FORBIDDEN",
  ]) {
    assert.ok(codes.has(code), `no rule reports under ${code}`)
  }
})

test("every workspace package is linted, whatever its name", () => {
  const eslintFiles = single[0].files
  for (const pkg of ["nivo-ui", "ui", "design-system"]) {
    assert.ok(eslintFiles.some((glob) => glob.startsWith("packages/*/")), `packages/${pkg} is not reached by the source block`)
  }
})

test("the Sonar way block lints the source outside the specs with the pinned sonarjs and unicorn plugins", () => {
  const sonar = config[2]
  assert.ok(sonar.ignores.some((glob) => glob.includes(".spec.")), "a spec is outside the scan")
  assert.ok(sonar.plugins.sonarjs?.rules && sonar.plugins.unicorn?.rules)
  assert.deepEqual(sonar.rules["sonarjs/cognitive-complexity"], ["error", 15])
  for (const name of ["sonarjs/no-nested-template-literals", "no-duplicate-imports", "unicorn/prefer-set-has"]) assert.ok(name in sonar.rules, `${name} is mapped`)
  for (const name of ["sonarjs/different-types-comparison", "sonarjs/function-return-type", "sonarjs/argument-type", "@typescript-eslint/prefer-optional-chain", "unicorn/prefer-top-level-await"]) {
    assert.equal(sonar.rules[name]?.[0], "error", `${name} is not left to the server`)
  }
  assert.deepEqual(sonar.rules["unicorn/consistent-function-scoping"], ["error"], "arrow functions are judged too")
  assert.equal(single[0].rules["starci-fe/max-params"], "error")
  assert.equal(single[0].rules["starci-fe/media-has-caption"], "error")
})
