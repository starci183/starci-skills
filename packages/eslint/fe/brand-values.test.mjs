/**
 * Twin tests for the raw brand value rule (HFS R61, TypeScript half).
 *
 *   node --test brand-values.test.mjs
 *
 * The cases that earn their place are the near misses: a fragment link that reads like a hex colour,
 * a component's `color="primary"` prop that reads like a paint, and a `data:` URI full of `#` and `px`.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noRawBrandValue, rules } from "./brand-values.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const BLOCK = "D:/repo/src/components/blocks/Feed/index.tsx"

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("BRAND-1: no raw colour, hex or px value outside brand.css", () => {
  tester.run("no-raw-brand-value", noRawBrandValue, {
    valid: [
      { filename: BLOCK, code: "const E = () => <div className=\"bg-surface text-foreground p-4\" />" },
      // a fragment link and ids are not colours
      { filename: BLOCK, code: "const E = () => <a href=\"#fee\">skip</a>" },
      { filename: BLOCK, code: "const E = () => <label htmlFor=\"#abc\" id=\"#def\" />" },
      // a component variant is a name, not a paint
      { filename: BLOCK, code: "const E = () => <Chip color=\"primary\" />" },
      { filename: BLOCK, code: "const o = { color: \"primary\" }" },
      // tokens and keywords
      { filename: BLOCK, code: "const E = () => <div style={{ color: \"var(--foreground)\", background: \"transparent\" }} />" },
      { filename: BLOCK, code: "const E = () => <svg><path fill=\"currentColor\" stroke=\"none\" /></svg>" },
      { filename: BLOCK, code: "const E = () => <div style={{ width: 0, opacity: 0.5, flex: 1 }} />" },
      // a data URI is opaque payload
      { filename: BLOCK, code: "const u = \"data:image/svg+xml,%3Csvg width='12px' fill='#fff'/%3E\"" },
      // an id that only looks like a number with a unit
      { filename: BLOCK, code: "const s = \"step2px\"" },
      // Tailwind arbitrary px belongs to no-arbitrary-value
      { filename: BLOCK, code: "const c = \"w-[12px]\"" },
      // specs may assert on raw values
      { filename: "D:/repo/src/components/blocks/Feed/index.test.tsx", code: "const c = \"#ff0000\"" },
    ],
    invalid: [
      { filename: BLOCK, code: "const c = \"#ff0000\"", errors: [{ messageId: "color" }] },
      { filename: BLOCK, code: "const c = \"#f00\"", errors: [{ messageId: "color" }] },
      { filename: BLOCK, code: "const c = \"#ff000080\"", errors: [{ messageId: "color" }] },
      { filename: BLOCK, code: "const E = () => <div style={{ color: \"#fff\" }} />", errors: [{ messageId: "color" }] },
      { filename: BLOCK, code: "const c = \"rgba(0, 0, 0, 0.5)\"", errors: [{ messageId: "color" }] },
      { filename: BLOCK, code: "const c = \"oklch(0.7 0.1 200)\"", errors: [{ messageId: "color" }] },
      { filename: BLOCK, code: "const c = \"bg-[#fff]\"", errors: [{ messageId: "color" }] },
      { filename: BLOCK, code: "const c = `1px solid #ccc`", errors: [{ messageId: "color" }] },
      { filename: BLOCK, code: "const w = \"12px\"", errors: [{ messageId: "length" }] },
      { filename: BLOCK, code: "const w = \"margin 0 -4.5px\"", errors: [{ messageId: "length" }] },
      { filename: BLOCK, code: "const E = () => <div style={{ width: 12 }} />", errors: [{ messageId: "length" }] },
      { filename: BLOCK, code: "const E = () => <div style={{ padding: 8, fontSize: 14 }} />", errors: [{ messageId: "length" }, { messageId: "length" }] },
      { filename: BLOCK, code: "const E = () => <div style={{ color: \"red\" }} />", errors: [{ messageId: "named" }] },
      { filename: BLOCK, code: "const E = () => <svg><path fill=\"red\" /></svg>", errors: [{ messageId: "named" }] },
      { filename: BLOCK, code: "const E = () => <svg><path fill=\"#123456\" /></svg>", errors: [{ messageId: "color" }] },
    ],
  })
})
