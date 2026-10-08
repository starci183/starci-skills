/**
 * Tests for the Sonar parity law (R235 SONAR_PARITY): the shared syntax rules, each against the code SonarCloud flagged in the examples.
 *
 *   node --test sonar-parity.spec.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { SONAR_SYNTAX_RULES } from "./runtime/scripts/lib/sonar-syntax-rules.mjs"
import { recommended, rules } from "./sonar-parity.mjs"

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
})
const rule = (name) => SONAR_SYNTAX_RULES[name]
const LOOP = "async function a(items) { for (const item of items) await send(item) }"

test("the law publishes each shared rule at error under its own name", () => {
  for (const [name, published] of Object.entries(rules)) {
    assert.ok(published?.meta && published.create, `${name} is not a rule`)
    assert.equal(recommended[`starci-be/${name}`], "error")
  }
  assert.ok(!("async-needs-await" in rules), "the async law owns async-needs-await")
  assert.ok(!("no-unused-prop-types" in rules), "props types are a front-end matter")
})

test("S9382: no await in a loop body, test or update; the iterable of for-of, a nested function and an endless loop are outside", () => {
  tester.run("no-await-in-loop", rule("no-await-in-loop"), {
    valid: [
      "async function a(items) { await Promise.all(items.map(async (item) => { await send(item) })) }",
      "async function b(source) { for (const x of await source()) use(x) }",
      "async function c(source) { for await (const chunk of source) use(chunk) }",
      "async function d(items) { for (const item of items) { const run = async () => { await send(item) }; later(run) } }",
      // an endless loop walks pages or polls: each turn needs the one before
      "async function e() { for (;;) { const page = await next(); if (!page) return } }",
      "async function f() { while (true) { await tick() } }",
    ],
    invalid: [
      { code: LOOP, errors: [{ messageId: "loop" }] },
      { code: "async function b() { while (await more()) { step() } }", errors: [{ messageId: "loop" }] },
      { code: "async function c() { for (let i = 0; i < 3; i = await next(i)) { step() } }", errors: [{ messageId: "loop" }] },
      { code: "async function d() { do { await tick() } while (open()) }", errors: [{ messageId: "loop" }] },
      { code: "async function e(o) { for (const k in o) { await send(k) } }", errors: [{ messageId: "loop" }] },
      { code: "async function f() { while (running) { await tick() } }", errors: [{ messageId: "loop" }] },
    ],
  })
})

test("a unit spec and an end-to-end spec are outside the scan, so outside the rules", () => {
  tester.run("no-await-in-loop", rule("no-await-in-loop"), {
    valid: [
      { filename: "src/a/a.spec.ts", code: LOOP },
      { filename: "src/a/a.e2e-spec.ts", code: LOOP },
    ],
    invalid: [
      { filename: "src/a/a.contract-spec.ts", code: LOOP, errors: [{ messageId: "loop" }] },
      { filename: "src/a/a.builder.ts", code: LOOP, errors: [{ messageId: "loop" }] },
    ],
  })
})

test("S7758: codePointAt and fromCodePoint instead of charCodeAt and fromCharCode", () => {
  tester.run("prefer-code-point", rule("prefer-code-point"), {
    valid: ["const a = char.codePointAt(0)", "const b = String.fromCodePoint(65)", "const c = other.fromCharCode(65)", "const d = text.charAt(0)"],
    invalid: [
      { code: "const a = char.charCodeAt(0)", errors: [{ messageId: "codePoint" }] },
      { code: "const b = String.fromCharCode(65)", errors: [{ messageId: "codePoint" }] },
    ],
  })
})

test("S7780: a string that only escapes backslashes is written with String.raw", () => {
  tester.run("prefer-string-raw", rule("prefer-string-raw"), {
    valid: [
      String.raw`const a = "no escapes"`,
      String.raw`const c = "tab\there"`,
      String.raw`const d = "a\\b\n"`,
      String.raw`const e = "ends\\"`,
      String.raw`import x from "a\\b"`,
      String.raw`export const config = { matcher: ["/((?!api|.*\\..*).*)"] }`,
      String.raw`const f = /a\\b/`,
      String.raw`const g = "has \\ and ${"`"}"`,
    ],
    invalid: [
      { code: String.raw`const a = "C:\\dir\\file"`, errors: [{ messageId: "raw" }] },
      { code: String.raw`const b = '\\d+'`, errors: [{ messageId: "raw" }] },
    ],
  })
})

test("S3358: a conditional expression is not nested in another", () => {
  tester.run("no-nested-conditional", rule("no-nested-conditional"), {
    valid: ["const a = x ? 1 : 2", "const b = x ? (y ? 1 : 2) === 1 : 0", "const c = f(x ? 1 : 2, y ? 3 : 4)"],
    invalid: [
      { code: "const a = x ? 1 : y ? 2 : 3", errors: [{ messageId: "nested" }] },
      { code: "const b = x ? (y ? 1 : 2) : 3", errors: [{ messageId: "nested" }] },
      { code: "const c = (x ? 1 : 2) ? 3 : 4", errors: [{ messageId: "nested" }] },
    ],
  })
})

test("S3735: void is kept only on a call", () => {
  tester.run("no-void-operator", rule("no-void-operator"), {
    valid: ["void attempts.mutate()", "void send()", "void (await send())", "void a?.run()"],
    invalid: [
      { code: "void principal", errors: [{ messageId: "void" }] },
      { code: "const a = void 0", errors: [{ messageId: "void" }] },
    ],
  })
})

test("S1128: an import nothing reads is removed", () => {
  tester.run("no-unused-import", rule("no-unused-import"), {
    valid: [
      "import { a } from 'x'\nexport const b = a()",
      "import type { T } from 'x'\nexport const b: T = 1",
      "import 'side-effect'",
      "import { a } from 'x'\nexport { a }",
      "import * as ns from 'x'\nexport const b = ns.value",
    ],
    invalid: [
      { code: "import { Order, Handoff } from 'x'\nexport const b: Handoff = 1", errors: [{ messageId: "unused", data: { name: "Order" } }] },
      { code: "import a from 'x'", errors: [{ messageId: "unused" }] },
      { code: "import * as ns from 'x'", errors: [{ messageId: "unused" }] },
    ],
  })
})

test("S7763: an import that is only handed on is re-exported with export from", () => {
  tester.run("prefer-export-from", rule("prefer-export-from"), {
    valid: [
      "export { a } from 'x'",
      "import { a } from 'x'\nexport const b = a()\nexport { a }",
      "import { a } from 'x'\nexport const b = () => a",
      // an annotation changes the type, so the declaration is not a plain re-export
      "import { a } from 'x'\nexport const b: Wider = a",
      "export const c = 1",
      "const local = 1\nexport { local }",
    ],
    invalid: [
      { code: "import { a } from 'x'\nexport { a }", errors: [{ messageId: "reexport", data: { name: "a" } }] },
      { code: "import { appHomeMetadata } from 'x'\nexport const generateMetadata = appHomeMetadata", errors: [{ messageId: "reexport", data: { name: "appHomeMetadata" } }] },
      { code: "import a from 'x'\nexport default a", errors: [{ messageId: "reexport" }] },
    ],
  })
})
