/** Twin tests for the lint escape-hatch fence. */
import assert from "node:assert/strict"
import test from "node:test"
import { Linter, RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { linterOptions } from "./lib/config.mjs"
import { at, fixtureHfs } from "./fixtures/typed/tester.mjs"
import { noInlineLintConfig, rules } from "./lint-escape-hatch.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
  settings: { starci: { hfs: fixtureHfs() } },
  linterOptions,
})

const SOURCE = at("apps/web/src/components/blocks/CreditStatRow/index.tsx")

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule?.meta && rule.create, `${name} is not a rule`)
})

test("LINT-ESCAPE-1: product source cannot change its own lint policy", () => {
  tester.run("no-inline-lint-config", noInlineLintConfig, {
    valid: [
      { filename: SOURCE, code: "// the rule is fixed centrally\nconst value = 1" },
      { filename: at("plugins/eslint/rule.test.mjs"), code: "const fixture = 'eslint-disable'" },
      // a file outside every product slot (tooling under a folder named src) is not governed
      { filename: at("tools/src/build.ts"), code: "// @ts-ignore\nconst value = 1" },
      // a comment that merely mentions a tool without being its directive
      { filename: SOURCE, code: "// coverage is measured by the runner, not by a marker\nconst value = 1" },
      { filename: SOURCE, code: "// the formatter is not asked to ignore anything here\nconst value = 1" },
      { filename: SOURCE, code: "// stylelint runs on the css files only\nconst value = 1" },
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
      // the other spellings of "not here": the compiler's own switches
      { filename: SOURCE, code: "// @ts-ignore\nconst value: number = 'x'", errors: [{ messageId: "typescript" }] },
      { filename: SOURCE, code: "// @ts-expect-error - legacy\nconst value: number = 'x'", errors: [{ messageId: "typescript" }] },
      { filename: SOURCE, code: "// @ts-nocheck\nconst value = 1", errors: [{ messageId: "typescript" }] },
      // the other tools' switches
      { filename: SOURCE, code: "const value = 1 // NOSONAR\n", errors: [{ messageId: "tool" }] },
      { filename: SOURCE, code: "// NOSONAR: legacy\nconst value = 1", errors: [{ messageId: "tool" }] },
      { filename: SOURCE, code: "// @sonar-ignore\nconst value = 1", errors: [{ messageId: "tool" }] },
      { filename: SOURCE, code: "/* istanbul ignore next */\nconst value = 1", errors: [{ messageId: "tool" }] },
      { filename: SOURCE, code: "/* istanbul ignore if */\nconst value = 1", errors: [{ messageId: "tool" }] },
      { filename: SOURCE, code: "/* c8 ignore next 3 */\nconst value = 1", errors: [{ messageId: "tool" }] },
      { filename: SOURCE, code: "/* c8 ignore start */\nconst value = 1", errors: [{ messageId: "tool" }] },
      { filename: SOURCE, code: "/* v8 ignore next */\nconst value = 1", errors: [{ messageId: "tool" }] },
      { filename: SOURCE, code: "// prettier-ignore\nconst value = [1,2]", errors: [{ messageId: "tool" }] },
      { filename: SOURCE, code: "/* stylelint-disable color-no-hex */\nconst value = 1", errors: [{ messageId: "tool" }] },
      { filename: SOURCE, code: "// stylelint-disable-next-line\nconst value = 1", errors: [{ messageId: "tool" }] },
      {
        filename: SOURCE,
        code: "/* eslint-env browser */\nconst value = 1",
        errors: [{ message: /has no effect/ }, { messageId: "directive" }],
      },
      {
        filename: SOURCE,
        code: "/* eslint no-console: \"off\" */\nconst value = 1",
        errors: [{ message: /has no effect/ }, { messageId: "directive" }],
      },
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

test("the fence also reports a disable directive that suppresses nothing", () => {
  assert.deepEqual(linterOptions, { noInlineConfig: true, reportUnusedDisableDirectives: "error" })
})

test("LINT-ESCAPE-2: the directive cannot silence its own guard", () => {
  const linter = new Linter({ configType: "flat" })
  const messages = linter.verify(
    "/* eslint-disable starci-fe/no-inline-lint-config */\nconst value = 1",
    {
      files: ["**/*.tsx"],
      languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
      settings: { starci: { hfs: fixtureHfs() } },
      linterOptions,
      plugins: { "starci-fe": { rules } },
      rules: { "starci-fe/no-inline-lint-config": "error" },
    },
    at("apps/web/src/components/blocks/Example/index.tsx"),
  )
  assert.equal(
    messages.find((message) => message.ruleId === "starci-fe/no-inline-lint-config")?.severity,
    2,
  )
})
