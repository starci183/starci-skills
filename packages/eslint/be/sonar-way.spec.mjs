/**
 * Tests for the Sonar way block of the back-end config factory (scripts/lib/sonar-way.mjs): the rules SonarSource's own port of the
 * Sonar way profile carries, at error over the files the scan judges, so `starci app lint` refuses what the scan would raise.
 *
 *   node --test sonar-way.spec.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { Linter } from "eslint"
import tsParser from "@typescript-eslint/parser"
import sonarjs from "eslint-plugin-sonarjs"
import unicorn from "eslint-plugin-unicorn"
import { starciBeConfig } from "./index.mjs"
import { SOURCE_FILES } from "./lib/config.mjs"
import { OUTSIDE_THE_SCAN_FILES } from "./runtime/scripts/lib/sonar-syntax-rules.mjs"
import { SONAR_WAY_EXTRA, sonarWayRules } from "./runtime/scripts/lib/sonar-way.mjs"
import { fixtureHfs } from "./fixtures/typed/tester.mjs"

const levelOf = (setting) => (Array.isArray(setting) ? setting[0] : setting)

test("the factory's third block is Sonar way over the scanned source, every rule at error", async () => {
    const [, , block] = await starciBeConfig({ hfs: fixtureHfs() })
    assert.deepEqual(block.files, [...SOURCE_FILES])
    assert.deepEqual(block.ignores, [...OUTSIDE_THE_SCAN_FILES])
    assert.ok(block.plugins.sonarjs?.rules && block.plugins.unicorn?.rules)
    for (const [name, setting] of Object.entries(block.rules)) assert.equal(levelOf(setting), "error", `${name} is not an error`)
    assert.deepEqual(block.rules["sonarjs/cognitive-complexity"], ["error", 15])
    assert.deepEqual(block.rules["max-params"], ["error", { max: 7 }])
    for (const name of ["sonarjs/slow-regex", "sonarjs/super-linear-regex", "sonarjs/no-alphabetical-sort", "sonarjs/no-nested-template-literals",
        "no-duplicate-imports", "@typescript-eslint/prefer-optional-chain", "unicorn/prefer-native-coercion-functions", "unicorn/prefer-includes", "unicorn/prefer-set-has"]) {
        assert.ok(name in block.rules, `${name} is mapped`)
    }
    for (const owned of ["sonarjs/no-nested-conditional", "sonarjs/unused-import", "sonarjs/void-use", "sonarjs/deprecation", "unicorn/prefer-top-level-await"]) {
        assert.ok(!(owned in block.rules), `${owned} stays with its owner or is not judged`)
    }
})

test("every mapped row names a Sonar id and every sonarjs rule Sonar way switches on is mapped or owned", () => {
    const { rules, mapped } = sonarWayRules(sonarjs)
    assert.ok(mapped.every((row) => /^S\d+$/.test(row.sonar)), "a row without its Sonar id")
    const on = Object.entries(sonarjs.configs.recommended.rules).filter(([, setting]) => levelOf(setting) === "error").map(([name]) => name)
    assert.equal(on.filter((name) => !(name in rules)).length, 4, "only the four owned rules are left to their owner")
    for (const row of SONAR_WAY_EXTRA.filter((entry) => entry.rule.startsWith("unicorn/"))) assert.ok(unicorn.rules[row.rule.slice("unicorn/".length)], `${row.rule} exists in the pinned unicorn`)
})

const linter = new Linter({ configType: "flat" })
const lint = (filename, code) => {
    const { rules } = sonarWayRules(sonarjs)
    const syntaxOnly = Object.fromEntries(Object.entries(rules).filter(([name]) => ["sonarjs/no-nested-template-literals", "max-params"].includes(name)))
    const config = [{ files: ["**/*.ts"], languageOptions: { parser: tsParser } }, { files: ["**/*.ts"], ignores: [...OUTSIDE_THE_SCAN_FILES], plugins: { sonarjs }, rules: syntaxOnly }]
    return linter.verify(code, config, { filename }).map((message) => message.ruleId)
}
const NESTED = "export const label = (a: string, b: string) => `x ${`y ${a}`} ${b}`\n"
const MANY = "export function eight(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) { return a + b + c + d + e + f + g + h }\n"

test("a nested template literal or an eighth parameter is refused in scanned source and passes in a spec", () => {
    assert.deepEqual(lint("src/a.service.ts", NESTED), ["sonarjs/no-nested-template-literals"])
    assert.deepEqual(lint("src/a.service.ts", MANY), ["max-params"])
    assert.deepEqual(lint("src/a.service.spec.ts", NESTED + MANY), [])
    assert.deepEqual(lint("src/a.service.ts", "export const label = (a: string) => `x ${a}`\n"), [])
})
