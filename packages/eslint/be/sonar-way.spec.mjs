/**
 * Tests for the Sonar way block of the back-end config factory (scripts/lib/sonar-way.mjs): the rules SonarSource's own port of the
 * Sonar way profile carries, at error over the files the scan judges, so `starci app lint` refuses what the scan would raise.
 *
 *   node --test sonar-way.spec.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import path from "node:path"
import { Linter } from "eslint"
import tsParser from "@typescript-eslint/parser"
import sonarjs from "eslint-plugin-sonarjs"
import unicorn from "eslint-plugin-unicorn"
import { starciBeConfig } from "./index.mjs"
import { SOURCE_FILES } from "./lib/config.mjs"
import { OUTSIDE_THE_SCAN_FILES, SONAR_SYNTAX_RULES } from "./runtime/scripts/lib/sonar-syntax-rules.mjs"
import { SONAR_WAY_EXTRA, SONAR_WAY_NOT_APPLICABLE, sonarWayRules } from "./runtime/scripts/lib/sonar-way.mjs"
import { fixtureHfs } from "./fixtures/typed/tester.mjs"

const levelOf = (setting) => (Array.isArray(setting) ? setting[0] : setting)

test("the factory's third block is Sonar way over the scanned source, every rule at error", async () => {
    const [, , block] = await starciBeConfig({ hfs: fixtureHfs() })
    assert.deepEqual(block.files, [...SOURCE_FILES])
    assert.deepEqual(block.ignores, [...OUTSIDE_THE_SCAN_FILES])
    assert.ok(block.plugins.sonarjs?.rules && block.plugins.unicorn?.rules)
    for (const [name, setting] of Object.entries(block.rules)) assert.equal(levelOf(setting), "error", `${name} is not an error`)
    assert.deepEqual(block.rules["sonarjs/cognitive-complexity"], ["error", 15])
    for (const name of ["sonarjs/slow-regex", "sonarjs/super-linear-regex", "sonarjs/no-alphabetical-sort", "sonarjs/no-nested-template-literals",
        "no-duplicate-imports", "unicorn/prefer-native-coercion-functions", "unicorn/prefer-includes", "unicorn/prefer-set-has"]) {
        assert.ok(name in block.rules, `${name} is mapped`)
    }
    for (const owned of ["sonarjs/no-nested-conditional", "sonarjs/unused-import", "sonarjs/void-use", "sonarjs/deprecation", "sonarjs/no-unused-vars", "max-params"]) {
        assert.ok(!(owned in block.rules), `${owned} stays with its owner`)
    }
    for (const name of ["sonarjs/different-types-comparison", "sonarjs/function-return-type", "sonarjs/argument-type", "@typescript-eslint/prefer-optional-chain"]) {
        assert.equal(levelOf(block.rules[name]), "error", `${name} is not left to the server`)
    }
    assert.ok(!("unicorn/prefer-top-level-await" in block.rules), "a CommonJS back end has no top-level await (S7785 is not applicable)")
    assert.deepEqual(SONAR_WAY_NOT_APPLICABLE.be, { S7785: "top-level await does not exist in the CommonJS output of a back end" })
    assert.deepEqual(block.rules["unicorn/consistent-function-scoping"], ["error"], "arrow functions are judged too")
})

test("every mapped row names a Sonar id and every sonarjs rule Sonar way switches on is mapped or owned", () => {
    const { rules, mapped } = sonarWayRules(sonarjs)
    assert.ok("unicorn/prefer-top-level-await" in rules && unicorn.rules["prefer-top-level-await"], "the front end (ESM) runs S7785")
    assert.ok(!("unicorn/prefer-top-level-await" in sonarWayRules(sonarjs, "be").rules), "the back end (CommonJS) does not")
    assert.ok(mapped.every((row) => /^S\d+$/.test(row.sonar)), "a row without its Sonar id")
    const on = Object.entries(sonarjs.configs.recommended.rules).filter(([, setting]) => levelOf(setting) === "error").map(([name]) => name)
    assert.equal(on.filter((name) => !(name in rules)).length, 5, "only the five rules another owner enforces at error are not run under their sonarjs name")
    for (const row of SONAR_WAY_EXTRA.filter((entry) => entry.rule.startsWith("unicorn/"))) assert.ok(unicorn.rules[row.rule.slice("unicorn/".length)], `${row.rule} exists in the pinned unicorn`)
})

const linter = new Linter({ configType: "flat" })
const lint = (filename, code) => {
    const { rules } = sonarWayRules(sonarjs)
    const syntaxOnly = Object.fromEntries(Object.entries(rules).filter(([name]) => name === "sonarjs/no-nested-template-literals"))
    const config = [{ files: ["**/*.ts"], languageOptions: { parser: tsParser } }, { files: ["**/*.ts"], ignores: [...OUTSIDE_THE_SCAN_FILES], plugins: { sonarjs, "starci-be": { rules: { "max-params": SONAR_SYNTAX_RULES["max-params"] } } }, rules: { ...syntaxOnly, "starci-be/max-params": "error" } }]
    return linter.verify(code, config, { filename }).map((message) => message.ruleId)
}
const NESTED = "export const label = (a: string, b: string) => `x ${`y ${a}`} ${b}`\n"
const MANY = "export function eight(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) { return a + b + c + d + e + f + g + h }\n"

test("a nested template literal or an eighth parameter is refused in scanned source and passes in a spec", () => {
    assert.deepEqual(lint("src/a.service.ts", NESTED), ["sonarjs/no-nested-template-literals"])
    assert.deepEqual(lint("src/a.service.ts", MANY), ["starci-be/max-params"])
    assert.deepEqual(lint("src/a.service.spec.ts", NESTED + MANY), [])
    assert.deepEqual(lint("src/a.service.ts", "export const label = (a: string) => `x ${a}`\n"), [])
})

// Parity with the server: a product scan with 0 issues on the server (Sonar way) and these forms are what the 1.7.19 lint reported
// there. The injected constructor and the narrowed comparison are clean source to the server, so they are clean to the lint.
const SERVER_CLEAN = [
    "const noDecoration = (): void => undefined",
    "function Injectable(): ClassDecorator { return noDecoration }",
    "@Injectable()",
    "export class DeskDailyService {",
    "    constructor(private readonly a: number, private readonly b: number, private readonly c: number, private readonly d: number,",
    "        private readonly e: number, private readonly f: number, private readonly g: number, private readonly h: number, private readonly i: number) {}",
    "}",
    "export const promoOf = (plan: { promo: number | null }, open: boolean) => {",
    "    const promo = open && plan.promo !== null",
    "    return promo && plan.promo !== null ? plan.promo : 0",
    "}",
    "export const without = (row: { isGlobal: boolean; name: string }) => { const { isGlobal: _isGlobal, ...rest } = row; return rest }",
    "",
].join("\n")

test("source the server passes is clean to the Sonar way rules: an injected constructor, a narrowed comparison, a rest-sibling omit", () => {
    const { rules } = sonarWayRules(sonarjs)
    const syntax = Object.fromEntries(Object.entries(rules).filter(([name]) => !name.startsWith("@typescript-eslint/") && !(sonarjs.rules[name.slice("sonarjs/".length)]?.meta?.docs?.requiresTypeChecking)))
    const config = [{ files: ["**/*.ts"], languageOptions: { parser: tsParser } },
        { files: ["**/*.ts"], plugins: { sonarjs, unicorn, "starci-be": { rules: { "max-params": SONAR_SYNTAX_RULES["max-params"] } } }, rules: { ...syntax, "starci-be/max-params": "error" } }]
    assert.deepEqual(linter.verify(SERVER_CLEAN, config, { filename: path.join(process.cwd(), "src", "desk-daily.service.ts") }).map((message) => `${message.ruleId}:${message.line}`), [])
})
