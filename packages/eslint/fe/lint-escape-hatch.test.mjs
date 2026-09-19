/** Twin tests for the lint escape-hatch fence. */
import assert from "node:assert/strict"
import path from "node:path"
import test from "node:test"
import { Linter, RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { linterOptions, noInlineLintConfig, rules } from "./lint-escape-hatch.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
  linterOptions,
})

const SOURCE = "D:/repo/src/components/blocks/dashboard/CreditStatRow/index.tsx"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule?.meta && rule.create, `${name} is not a rule`)
})

test("LINT-ESCAPE-1: product source cannot change its own lint policy", () => {
  tester.run("no-inline-lint-config", noInlineLintConfig, {
    valid: [
      { filename: SOURCE, code: "// the rule is fixed centrally\nconst value = 1" },
      { filename: "D:/repo/plugins/eslint/rule.test.mjs", code: "const fixture = 'eslint-disable'" },
      /*
       * PROSE ABOUT A DIRECTIVE IS NOT A DIRECTIVE. A comment that explains why a file carries no
       * `eslint-disable` is the most useful comment on the subject a file can hold, and the earlier
       * unanchored pattern reported it - so the only way to a green gate was to delete the
       * explanation. ESLint reads a directive from the first non-space character of the comment and
       * nowhere else, so anchoring loses no real escape.
       */
      {
        filename: SOURCE,
        code: "// There is no eslint-disable on this line - the Next plugin is not configured here.\nconst value = 1",
      },
      {
        filename: SOURCE,
        code: "/*\n * Why this file needs no eslint-disable-next-line: the rule it would silence is off.\n */\nconst value = 1",
      },
    ],
    invalid: [
      {
        filename: SOURCE,
        code: "/* eslint-disable */\nconst value = 1",
        errors: [{ message: /has no effect/ }, { messageId: "directive" }],
      },
      {
        filename: SOURCE,
        code: "// eslint-disable-next-line no-console\nconsole.log('x')",
        errors: [{ message: /has no effect/ }, { messageId: "directive" }],
      },
      {
        filename: SOURCE,
        code: "/* eslint-enable */\nconst value = 1",
        errors: [{ message: /has no effect/ }, { messageId: "directive" }],
      },
    ],
  })
})

test("LINT-ESCAPE-2: the directive cannot silence its own guard", () => {
  const linter = new Linter({ configType: "flat" })
  const messages = linter.verify(
    "/* eslint-disable starci-fe/no-inline-lint-config */\nconst value = 1",
    {
      files: ["**/*.tsx"],
      languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
      linterOptions,
      plugins: { "starci-fe": { rules } },
      rules: { "starci-fe/no-inline-lint-config": "error" },
    },
    path.join(process.cwd(), "src/components/Example/index.tsx"),
  )
  assert.equal(
    messages.find((message) => message.ruleId === "starci-fe/no-inline-lint-config")?.severity,
    2,
  )
})
