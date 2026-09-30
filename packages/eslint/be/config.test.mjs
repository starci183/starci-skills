/**
 * Twin tests for the back-end config factory.
 *
 *   node --test config.test.mjs
 *
 * The failures worth catching: a rule published at anything but `error`, a config that a repository could weaken
 * (globs, ignores, overrides), a config without typed linting or without the HFS settings the path-scoped rules read,
 * and a repository whose hfs.json is not a back end.
 */
import assert from "node:assert/strict"
import test from "node:test"
import plugin, { linterOptions, loadHfs, recommended, starciBeConfig } from "./index.mjs"
import { BORROWED, IGNORED, SOURCE_FILES, buildBeConfig } from "./lib/config.mjs"
import { fixtureHfs } from "./fixtures/typed/tester.mjs"

const levelOf = (setting) => (Array.isArray(setting) ? setting[0] : setting)

test("every published rule ships at error", () => {
    const weak = Object.entries(recommended).filter(([, setting]) => levelOf(setting) !== "error")
    assert.deepEqual(weak, [])
    assert.deepEqual(Object.keys(recommended).sort(), Object.keys(plugin.rules).map((name) => `starci-be/${name}`).sort())
})

test("the config is one ignore block and one typed rule block over every source, with the HFS settings", async () => {
    const hfs = fixtureHfs()
    const [ignore, block] = await starciBeConfig({ hfs })
    assert.deepEqual(ignore, { ignores: [...IGNORED] })
    assert.deepEqual(IGNORED, ["dist/**", "coverage/**", "**/node_modules/**"])
    assert.deepEqual(block.files, [...SOURCE_FILES])
    assert.ok(block.languageOptions.parserOptions.projectService, "typed linting is on")
    assert.equal(block.languageOptions.parserOptions.tsconfigRootDir, hfs.repoRoot)
    assert.equal(block.settings.starci.hfs, hfs)
    assert.deepEqual(block.linterOptions, linterOptions)
    assert.deepEqual(linterOptions, { noInlineConfig: true, reportUnusedDisableDirectives: "error" })
    assert.equal(block.plugins["starci-be"], plugin)
    assert.ok(block.plugins["@typescript-eslint"]?.rules, "the borrowed rules have their plugin")
    for (const [name, setting] of Object.entries(block.rules)) assert.equal(levelOf(setting), "error", `${name} is not an error`)
    for (const name of Object.keys(BORROWED)) assert.ok(name in block.rules, `${name} is borrowed`)
    assert.deepEqual(block.rules["@typescript-eslint/consistent-type-assertions"], ["error", { assertionStyle: "never" }])
})

test("the factory takes only the HFS view: no globs, ignores or rule overrides", async () => {
    const [, block] = await starciBeConfig({ hfs: fixtureHfs(), files: ["src/**"], rules: { "starci-be/error-home": "off" }, ignores: ["src/**"] })
    assert.deepEqual(block.files, [...SOURCE_FILES])
    assert.equal(block.rules["starci-be/error-home"], "error")
})

test("a missing HFS view, a front-end profile or a weakened recommendation is refused", async () => {
    await assert.rejects(() => starciBeConfig({}), /loadHfs\(import\.meta\.url\)/)
    await assert.rejects(() => starciBeConfig({ hfs: { ...fixtureHfs(), profile: "fe" } }), /profile fe/)
    await assert.rejects(() => buildBeConfig({ hfs: fixtureHfs(), plugin, recommended: { ...recommended, "starci-be/error-home": "warn" } }), /not at error: starci-be\/error-home/)
    await assert.rejects(() => buildBeConfig({ hfs: fixtureHfs(), plugin, recommended: { ...recommended, "starci-be/error-home": ["off"] } }), /not at error/)
    await assert.rejects(() => buildBeConfig({ hfs: fixtureHfs(), plugin, recommended: {} }), /empty recommendation/)
})

test("loadHfs reads the hfs.json beside the config file", () => {
    assert.equal(typeof loadHfs, "function")
    assert.throws(() => loadHfs(new URL("./no-such-dir/eslint.config.mjs", import.meta.url).href), /hfs\.json/)
})

test("the borrowed cast rules reach a unit spec: no `as` and no `x!` in a `.service.spec.ts`", async () => {
    const { Linter } = await import("eslint")
    const { default: tsParser } = await import("@typescript-eslint/parser")
    const [, block] = await starciBeConfig({ hfs: fixtureHfs() })
    const borrowed = Object.fromEntries(Object.entries(block.rules).filter(([name]) => name === "@typescript-eslint/consistent-type-assertions" || name === "@typescript-eslint/no-non-null-assertion"))
    const lint = (code, filename) => new Linter({ configType: "flat" }).verify(code, [{ ...block, languageOptions: { parser: tsParser, ecmaVersion: "latest", sourceType: "module" }, rules: borrowed }], { filename })
    const spec = "src/modules/domain/order/order.service.spec.ts"
    assert.deepEqual(lint("declare const raw: unknown\nexport const row = raw as { id: number }", spec).map((message) => message.ruleId), ["@typescript-eslint/consistent-type-assertions"])
    assert.deepEqual(lint("declare const raw: { id?: number }\nexport const id = raw.id!", spec).map((message) => message.ruleId), ["@typescript-eslint/no-non-null-assertion"])
    assert.deepEqual(lint("declare const raw: { id?: number }\nexport const id = raw.id ?? 0", spec), [])
})
