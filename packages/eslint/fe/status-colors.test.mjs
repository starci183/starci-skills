/**
 * Twin tests for `starci-fe/status-text-uses-soft-foreground`.
 *
 *   node --test status-colors.test.mjs
 *
 * The violating cases are the shapes a solid tone hides in: a plain className, a `cn()` call, a conditional, a variant
 * prefix, an opacity suffix, a hoisted constant and a `classes` entry. The passing cases are the soft pair, the solid
 * fill with its own ink, and every neighbour that shares a prefix with a finding.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { solidTextClasses, rules, statusTextUsesSoftForeground } from "./status-colors.mjs"
import { STATUS_TONES } from "./lib/status-tones.generated.mjs"

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
})

const FILE = "D:/repo/src/components/leaves/StatusText/index.tsx"
const SPEC = "D:/repo/src/components/leaves/StatusText/index.spec.tsx"
const solid = { messageId: "solid" }

test("the rule is exported under its published name", () => {
  assert.deepEqual(Object.keys(rules), ["status-text-uses-soft-foreground"])
})

test("the tones are the grammar's status tones, info included", () => {
  assert.deepEqual(STATUS_TONES, ["success", "warning", "danger", "info"])
})

test("solidTextClasses reads variants, opacity, important and every painting family, and nothing else", () => {
  const found = (text) => solidTextClasses(text).map((entry) => entry.token)
  assert.deepEqual(found("text-success fill-danger stroke-warning decoration-info"), ["text-success", "fill-danger", "stroke-warning", "decoration-info"])
  assert.deepEqual(found("md:hover:text-success dark:text-danger/60 [&>svg]:fill-info !text-warning text-success/[.4]"), [
    "md:hover:text-success",
    "dark:text-danger/60",
    "[&>svg]:fill-info",
    "!text-warning",
    "text-success/[.4]",
  ])
  assert.deepEqual(
    found("text-success-soft-foreground bg-success-soft bg-success text-success-foreground border-danger ring-warning text-successful text-accent text-foreground fill-current"),
    [],
  )
  assert.deepEqual(found("[&:hover]:bg-success"), [])
})

test("status-text-uses-soft-foreground", () => {
  tester.run("status-text-uses-soft-foreground", statusTextUsesSoftForeground, {
    valid: [
      // the soft pair, alone and on its tint
      { filename: FILE, code: 'const E = () => <span className="text-success-soft-foreground" />' },
      { filename: FILE, code: 'const E = () => <span className="bg-success-soft text-success-soft-foreground px-2" />' },
      { filename: FILE, code: 'const E = () => <svg className="fill-danger-soft-foreground stroke-warning-soft-foreground" />' },
      // a solid button: the tone as the fill, its own ink on it
      { filename: FILE, code: 'const E = () => <button className="bg-success text-success-foreground hover:bg-success-hover" />' },
      // a boundary is not text
      { filename: FILE, code: 'const E = () => <div className="border-danger ring-2 ring-warning outline-info bg-info/10" />' },
      // neighbours that share a prefix
      { filename: FILE, code: 'const E = () => <p className="text-successful text-foreground text-muted text-accent-soft-foreground" />' },
      // conditionals and cn() with only soft classes
      { filename: FILE, code: 'const E = ({ ok }) => <p className={cn("text-sm", ok ? "text-success-soft-foreground" : "text-danger-soft-foreground")} />' },
      // strings that are not class strings
      { filename: FILE, code: 'const E = () => <p title="text-success" data-id="fill-danger">{"text-success"}</p>' },
      // a spec asserts about class names rather than painting with them
      { filename: SPEC, code: 'const solid = "text-success"' },
    ],
    invalid: [
      { filename: FILE, code: 'const E = () => <span className="text-success" />', errors: [solid] },
      { filename: FILE, code: 'const E = () => <span class="text-danger font-medium" />', errors: [solid] },
      { filename: FILE, code: 'const E = () => <svg className="fill-warning size-4" />', errors: [solid] },
      { filename: FILE, code: 'const E = () => <svg className="stroke-info" />', errors: [solid] },
      { filename: FILE, code: 'const E = () => <a className="underline decoration-danger" />', errors: [solid] },
      // variants and opacity do not launder the tone: one finding per class token
      { filename: FILE, code: 'const E = () => <p className="md:hover:text-success dark:text-danger/60 [&>svg]:fill-info" />', errors: [solid, solid, solid] },
      // through cn(), a conditional and a logical expression
      { filename: FILE, code: 'const E = ({ ok }) => <p className={cn("text-sm", ok ? "text-success" : "text-danger-soft-foreground")} />', errors: [solid] },
      { filename: FILE, code: 'const E = ({ bad }) => <p className={bad && "text-danger"} />', errors: [solid] },
      { filename: FILE, code: 'const E = ({ bad }) => <p className={clsx({ "text-warning": bad })} />', errors: [solid] },
      { filename: FILE, code: "const E = () => <p className={`text-info ${x}`} />", errors: [solid] },
      // the shapes that hide from a JSX-only reader: a constant, an array, a classes entry
      { filename: FILE, code: 'const OK = "inline-flex text-success"', errors: [solid] },
      { filename: FILE, code: 'const TONES = { ok: "text-success", bad: ["text-danger", "font-medium"] }', errors: [solid, solid] },
      { filename: FILE, code: 'const C = { x: { classes: ["flex", "text-warning"] } }', errors: [solid] },
      // the hover mix of the solid tone is still the solid tone
      { filename: FILE, code: 'const E = () => <p className="text-success-hover" />', errors: [solid] },
      // the message names the class to use instead
      {
        filename: FILE,
        code: 'const E = () => <span className="text-success" />',
        errors: [{ message: /`text-success` paints text or an icon with the solid `success` tone.*`text-success-soft-foreground`.*`bg-success-soft`/ }],
      },
    ],
  })
})
