/**
 * Twin tests for the type-safety rule.
 *
 *   node --test type-safety.test.mjs
 *
 * The single cast is the case that matters. `x as T` is a narrowing the compiler can still partly
 * check, and forbidding it would make the rule an argument rather than a boundary - so the valid
 * cases pin that difference down, and the test exemption pins down the one file kind that has to
 * build values the types forbid.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noDoubleCast, rules } from "./type-safety.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const SOURCE = "D:/repo/src/modules/api/graphql/clients/links/bearer.ts"
const TEST = "D:/repo/src/modules/api/graphql/clients/links/bearer.test.ts"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("TYPE-SAFETY-1: a cast through unknown erases what the compiler knew", () => {
  tester.run("no-double-cast", noDoubleCast, {
    valid: [
      // a single cast is a claim the compiler can still partly check
      { filename: SOURCE, code: "const row = payload as ResumeRow" },
      // narrowing FROM unknown is the shape this rule is asking for
      { filename: SOURCE, code: "const answer: unknown = parse(text)" },
      { filename: SOURCE, code: "const n = value as unknown" },
      // a test builds values the types forbid, because that is what it is proving
      { filename: TEST, code: "return operation as unknown as ApolloLink.Operation" },
    ],
    invalid: [
      {
        filename: SOURCE,
        code: "const row = payload as unknown as ResumeRow",
        errors: [{ messageId: "double" }],
      },
      {
        filename: SOURCE,
        code: "const op = build() as unknown as Operation",
        errors: [{ messageId: "double" }],
      },
    ],
  })
})
