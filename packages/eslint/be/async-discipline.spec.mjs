/**
 * Twin tests for the async-discipline rule.
 *
 *   node --test async-discipline.spec.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { asyncNeedsAwait, rules } from "./async-discipline.mjs"

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const SRC = "src/modules/domain/plan/plan.service.ts"
const SPEC = "src/modules/domain/plan/plan.service.spec.ts"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("R73: an async function awaits something", () => {
  tester.run("async-needs-await", asyncNeedsAwait, {
    valid: [
      { filename: SRC, code: "async function load() { return await fetchPlan() }" },
      { filename: SRC, code: "const load = async () => { const plan = await fetchPlan(); return plan }" },
      { filename: SRC, code: "const load = async () => await fetchPlan()" },
      { filename: SRC, code: "async function drain(source) { for await (const chunk of source) use(chunk) }" },
      { filename: SRC, code: "async function* pages() { yield 1 }" },
      { filename: SRC, code: "function load() { return fetchPlan() }" },
      // the base contract fixes the return type: an implementing or extending class is exempt
      { filename: SRC, code: "class Handler implements Contract { async run() { return 1 } }" },
      { filename: SRC, code: "class Handler extends Base { async run() { return 1 } }" },
      // a framework decorator fixes it
      { filename: SRC, code: "class Boot { @OnEvent('x') async onX() { log() } }" },
    ],
    invalid: [
      // specs get the same law: a mock that returns a promise says so with Promise.resolve
      { filename: SPEC, code: "const load = async () => 1", errors: [{ messageId: "noAwait" }] },
      { filename: SRC, code: "async function load() { return 1 }", errors: [{ messageId: "noAwait" }] },
      { filename: SRC, code: "const load = async () => { return plan }", errors: [{ messageId: "noAwait" }] },
      { filename: SRC, code: "const load = async (request) => service.confirm(request)", errors: [{ messageId: "noAwait" }] },
      { filename: SRC, code: "class Plans { async list() { return this.rows } }", errors: [{ messageId: "noAwait" }] },
      // an await in a nested function does not count for the outer one
      { filename: SRC, code: "async function outer() { const inner = async () => await one(); return inner }", errors: [{ messageId: "noAwait" }] },
    ],
  })
})
