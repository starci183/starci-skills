/**
 * Twin tests for the type-safety rules.
 *
 *   node --test type-safety.test.mjs
 *
 * `no-double-cast` is the one with a real trap in it: a single `as unknown` is legitimate (widening
 * on the way OUT of a value is honest), and only the pair that lands back on a concrete type is the
 * overrule. A rule that fired on either cast alone would flag correct code constantly.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noConstEnum, noDoubleCast, noInlineParamType, rules } from "./type-safety.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
})

const SRC = "D:/repo/src/modules/bussiness/user/user.service.ts"
const SPEC = "D:/repo/src/modules/bussiness/user/user.service.spec.ts"
const TESTS = "D:/repo/src/tests/helpers/create-e2e-app.ts"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("TYPE-2: the double cast is refused in product code and allowed in the test lanes", () => {
  tester.run("no-double-cast", noDoubleCast, {
    valid: [
      // widening on the way out is honest
      { filename: SRC, code: "const raw = value as unknown" },
      // a single narrowing cast is not this rule's business
      { filename: SRC, code: "const row = raw as EnrollmentEntity" },
      // a cast pair that does not go through `unknown`
      { filename: SRC, code: "const n = (x as number) as 1" },
      // building a deliberately wrong value is how a spec proves an API refuses it
      { filename: SPEC, code: "const bad = {} as unknown as EnrollmentEntity" },
      { filename: TESTS, code: "const bad = {} as unknown as EntityManager" },
    ],
    invalid: [
      {
        filename: SRC,
        code: "const row = raw as unknown as EnrollmentEntity",
        errors: [{ messageId: "doubleCast" }],
      },
    ],
  })
})

test("TYPE-3: a destructured parameter takes a named type", () => {
  tester.run("no-inline-param-type", noInlineParamType, {
    valid: [
      "export const grantXp = ({ userId, amount }: GrantXpParams) => null",
      // a positional parameter with an inline type is a different (smaller) problem
      "export const grantXp = (params: { userId: string }) => null",
      // no annotation at all is the compiler's business, not this rule's
      "export const grantXp = ({ userId }) => null",
    ],
    invalid: [
      {
        code: "export const grantXp = ({ userId, amount }: { userId: string, amount: number }) => null",
        errors: [{ messageId: "inline" }],
      },
      {
        code: "function grantXp({ userId }: { userId: string }) { return userId }",
        errors: [{ messageId: "inline" }],
      },
    ],
  })
})

test("TYPE-4: an enum keeps its runtime object", () => {
  tester.run("no-const-enum", noConstEnum, {
    valid: [
      "export enum Verdict { Pass, Fail }",
      "declare enum Ambient { A }",
    ],
    invalid: [
      { code: "export const enum Verdict { Pass, Fail }", errors: [{ messageId: "constEnum" }] },
    ],
  })
})
