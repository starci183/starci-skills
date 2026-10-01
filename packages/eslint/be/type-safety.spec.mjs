/**
 * Twin tests for the type-safety rules.
 *
 *   node --test type-safety.spec.mjs
 *
 * The assertion rules (`as`, `x!`, `any`) are the factory's borrowed typescript-eslint rules and are held by
 * `config.spec.mjs`; a spec is judged by every rule here exactly like product code.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  explicitHandlerReturnType,
  noConstEnum,
  noFunctionOrEval,
  noInlineObjectType,
  noInlineParamType,
  rules,
} from "./type-safety.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
})

const SRC = "src/modules/domain/user/user.service.ts"
const SPEC = "src/modules/domain/user/user.service.spec.ts"
const TESTS = "src/tests/fixtures/create-user.ts"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("R72: the Function type, eval and new Function are refused everywhere, specs included", () => {
  tester.run("no-function-or-eval", noFunctionOrEval, {
    valid: [
      { filename: SRC, code: "const run = (task: () => void): void => task()" },
      { filename: SRC, code: "interface Function2 { call(): void }" },
      // a local declaration named Function is not the global type
      { filename: SRC, code: "interface Function { call(): void }; const f: Function = g" },
      { filename: SRC, code: "const evaluate = (eval2: string) => eval2" },
    ],
    invalid: [
      { filename: SRC, code: "const run = (task: Function): void => task()", errors: [{ messageId: "functionType" }] },
      { filename: SPEC, code: "const run = (task: Function): void => task()", errors: [{ messageId: "functionType" }] },
      { filename: SRC, code: "const out = eval(source)", errors: [{ messageId: "evaluated" }] },
      { filename: SPEC, code: "const out = new Function('a', 'return a')", errors: [{ messageId: "evaluated" }] },
      { filename: SRC, code: "const out = Function('return 1')()", errors: [{ messageId: "evaluated" }] },
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

test("TYPE-3 (law 4, extended): every inline object type takes a named type, not only the destructured parameter", () => {
  tester.run("no-inline-object-type", noInlineObjectType, {
    valid: [
      // position 1, parameter: already named
      "export const grantXp = (input: GrantXpParams) => null",
      // position 2, property signature: already named
      "interface A { b: EnrollmentEntity }",
      // position 3, return type: already named
      "export const getStatus = (): GradingResult => result",
      // position 4, variable: already named
      "const x: EnrollmentEntity = row",
      // an inline object type that IS the right-hand side of a named type alias is the fix itself
      "type Foo = { a: string }",
      // ... but a property nested inside that same alias still needs its own name
      // (covered as an invalid case below, not here -- this case only proves the outer literal is exempt)
      // an empty type literal means "no properties", a different smell with a different fix
      "export const configure = (options: {}) => null",
      // a vendor's own shape inside a module augmentation cannot be named separately
      `declare module "express" {
        interface Request {
          user: { id: string, roles: Array<string> }
        }
      }`,
    ],
    invalid: [
      // a spec gets the same law: there is no test-lane exemption
      { filename: SPEC, code: "const mock = (input: { a: string }): { ok: boolean } => ({ ok: true })", errors: [{ messageId: "inlineObjectType" }, { messageId: "inlineObjectType" }] },
      { filename: TESTS, code: "const x: { a: number } = { a: 1 }", errors: [{ messageId: "inlineObjectType" }] },
      // position 1: a parameter
      {
        filename: SRC,
        code: "export const grantXp = (input: { userId: string, amount: number }) => null",
        errors: [{ messageId: "inlineObjectType", data: { position: "parameter" } }],
      },
      // position 2: a property signature -- including one nested inside an otherwise-named alias
      {
        filename: SRC,
        code: "interface A { b: { c: number } }",
        errors: [{ messageId: "inlineObjectType", data: { position: "property signature" } }],
      },
      {
        filename: SRC,
        code: "type Foo = { a: { b: number } }",
        errors: [{ messageId: "inlineObjectType", data: { position: "property signature" } }],
      },
      // position 3: a function return
      {
        filename: SRC,
        code: "export const getStatus = (): { ok: boolean } => ({ ok: true })",
        errors: [{ messageId: "inlineObjectType", data: { position: "return type" } }],
      },
      // position 4: a variable
      {
        filename: SRC,
        code: "const x: { a: number } = row",
        errors: [{ messageId: "inlineObjectType", data: { position: "variable" } }],
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

test("R75: handlers and public methods of an Injectable, Resolver or Controller declare a return type", () => {
  tester.run("explicit-handler-return-type", explicitHandlerReturnType, {
    valid: [
      { filename: SRC, code: "@Resolver() export class PlanResolver { @Query(() => String) plan(): Promise<string> { return load() } }" },
      { filename: SRC, code: "@Injectable() export class PlanService { list(): Promise<Plan[]> { return this.rows } }" },
      { filename: SRC, code: "@Injectable() export class PlanService { private helper() { return 1 } }" },
      { filename: SRC, code: "@Injectable() export class PlanService { protected helper() { return 1 } }" },
      { filename: SRC, code: "@Injectable() export class PlanService { constructor(private readonly rows: Rows) {} }" },
      { filename: SRC, code: "export class Plain { list() { return 1 } }" },
    ],
    invalid: [
      { filename: SPEC, code: "@Injectable() export class PlanService { list() { return 1 } }", errors: [{ messageId: "publicMethod" }] },
      { filename: SRC, code: "@Resolver() export class PlanResolver { @Query(() => String) plan() { return load() } }", errors: [{ messageId: "handler" }] },
      { filename: SRC, code: "@Controller() export class PlanController { @Get() list() { return [] } }", errors: [{ messageId: "handler" }] },
      { filename: SRC, code: "@Injectable() export class PlanService { list() { return this.rows } }", errors: [{ messageId: "publicMethod" }] },
    ],
  })
})
