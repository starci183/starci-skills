/**
 * Twin tests for the token rules.
 *
 *   node --test tokens.test.mjs
 *
 * These rules exist for the ONE folder the union cannot reach, so the cases that matter are the
 * ones where a value hides: in a module constant rather than in markup, and in an entry's class
 * ARRAY rather than in a string. Both are shapes that a previous version of this enforcement walked
 * straight past while reporting a clean tree.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { noArbitraryValue, noFractionalStep, noHandRolledHeading, noUnresolvedTokenClass, rules } from "./tokens.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const LEAF = "D:/repo/src/components/leaves/Text/index.tsx"
const TABLE = "D:/repo/src/components/contracts/index.ts"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("TOKEN-3: a fractional step is off the ladder, wherever it is written", () => {
  tester.run("no-fractional-step", noFractionalStep, {
    valid: [
      { filename: LEAF, code: "const G = \"inline-flex items-center gap-2\"" },
      { filename: LEAF, code: "const E = () => <p className=\"gap-3 p-4\" />" },
      // a decimal that is not a measurement
      { filename: LEAF, code: "const RATIO = \"1.5\"" },
    ],
    invalid: [
      // markup
      { filename: LEAF, code: "const E = () => <p className=\"gap-1.5\" />", errors: [{ messageId: "fractional" }] },
      // the shape that hid from every earlier version: a module constant
      { filename: LEAF, code: "const GLUE = \"inline-flex items-center gap-1.5\"", errors: [{ messageId: "fractional" }] },
      { filename: LEAF, code: "const CARET = \"size-3.5 shrink-0\"", errors: [{ messageId: "fractional" }] },
      // and an entry's class array
      {
        filename: TABLE,
        code: "const C = { x: { classes: [\"flex\", \"py-1.5\"] } }",
        errors: [{ messageId: "fractional" }],
      },
    ],
  })
})

test("TOKEN-4: an arbitrary value escapes the vocabulary even when it matches it", () => {
  tester.run("no-arbitrary-value", noArbitraryValue, {
    valid: [
      { filename: LEAF, code: "const C = \"gap-4 p-6 text-muted\"" },
      // a variant selector is not a measurement
      { filename: LEAF, code: "const C = \"[&>*]:w-full\"" },
    ],
    invalid: [
      { filename: LEAF, code: "const C = \"gap-[13px]\"", errors: [{ messageId: "length" }] },
      { filename: LEAF, code: "const C = \"max-w-[42rem]\"", errors: [{ messageId: "length" }] },
      { filename: LEAF, code: "const C = \"text-[#ff0000]\"", errors: [{ messageId: "colour" }] },
      {
        filename: TABLE,
        code: "const C = { x: { classes: [\"flex\", \"gap-[7px]\"] } }",
        errors: [{ messageId: "length" }],
      },
    ],
  })
})

test("TOKEN-5: large text plus a heavy weight is a heading", () => {
  tester.run("no-hand-rolled-heading", noHandRolledHeading, {
    valid: [
      // large text alone is a size decision, not a heading
      { filename: LEAF, code: "const C = \"text-2xl\"" },
      // weight alone is emphasis within body text, which the type scale allows
      { filename: LEAF, code: "const C = \"text-sm font-bold\"" },
      { filename: LEAF, code: "const C = \"text-base font-medium\"" },
    ],
    invalid: [
      { filename: LEAF, code: "const C = \"text-2xl font-bold\"", errors: [{ messageId: "heading" }] },
      {
        filename: LEAF,
        code: "const E = () => <span className=\"text-xl font-extrabold\">{t}</span>",
        errors: [{ messageId: "heading" }],
      },
    ],
  })
})

/** A repository whose stylesheet defines ONE container token, built fresh for this run. */
const themedRoot = () => {
  const root = mkdtempSync(join(tmpdir(), "starci-tokens-")).replace(/\\/g, "/")
  mkdirSync(join(root, "src/app"), { recursive: true })
  writeFileSync(
    join(root, "src/app/globals.css"),
    "@theme {\n    --container-app-sm: 40rem;\n    --max-height-rail: calc(100dvh - 7rem);\n}\n",
    "utf8",
  )
  return root
}

const THEMED = themedRoot()

test("TOKEN-9: a class naming a theme token is dead unless the theme defines it", () => {
  tester.run("no-unresolved-token-class", noUnresolvedTokenClass, {
    valid: [
      // The token exists, so the class means what it says.
      { filename: `${THEMED}/src/components/pages/Reader/component.tsx`, code: 'const M = "mx-auto max-w-app-sm"' },
      { filename: `${THEMED}/src/components/layouts/Rail/component.tsx`, code: 'const R = "max-h-rail overflow-y-auto"' },
      // Tailwind's own scale, not a theme promise: nothing here is derivable from a variable name.
      { filename: `${THEMED}/src/components/pages/Reader/component.tsx`, code: 'const S = "max-w-sm gap-4 text-muted"' },
      // Outside src, this is somebody else\'s rule to enforce.
      { filename: `${THEMED}/scripts/report.mjs`, code: 'const M = "max-w-app-xl"' },
    ],
    invalid: [
      {
        filename: `${THEMED}/src/components/pages/Reader/component.tsx`,
        code: 'const M = "mx-auto max-w-app-xl"',
        errors: [{ messageId: "unresolved", data: { value: "max-w-app-xl", variable: "--container-app-xl" } }],
      },
      {
        filename: `${THEMED}/src/components/layouts/Rail/component.tsx`,
        code: 'const R = "max-h-drawer"',
        errors: [{ messageId: "unresolved" }],
      },
    ],
  })
})
