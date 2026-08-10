/**
 * Twin tests for the props-and-slots rule.
 *
 *   node --test props-and-slots.test.mjs
 *
 * The valid cases carry the weight here. This rule fires on ONE shape - an object pattern with an
 * inline type - and a version that widened to "any parameter with a type" would fire on every
 * ordinary function in the tree, which is how a rule earns a blanket disable comment.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noInlineParameterType, rules } from "./props-and-slots.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("SLOTS-3: a destructured parameter's shape is named in the module", () => {
  tester.run("no-inline-parameter-type", noInlineParameterType, {
    valid: [
      "export const Row = ({ props }: RowProps) => null",
      "export const Row = ({ props }: LeafProps<RowData>) => null",
      // untyped destructuring is a different question, and not this rule's
      "const f = ({ a }) => a",
      // a named scalar parameter is not a shape with nowhere to be read from
      "const f = (value: string) => value",
      // an inline type on a NON-destructured parameter still has a binding to read it by
      "const f = (input: { a: string }) => input.a",
    ],
    invalid: [
      {
        code: "export const Row = ({ props }: { props: { label: string } }) => null",
        errors: [{ messageId: "inline" }],
      },
      {
        code: "const f = function ({ a }: { a: string }) { return a }",
        errors: [{ messageId: "inline" }],
      },
      {
        // parentheses do not hide it
        code: "const f = ({ a }: ({ a: string })) => a",
        errors: [{ messageId: "inline" }],
      },
    ],
  })
})
