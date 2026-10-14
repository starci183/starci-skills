// proves: HFS_FUNCTION_BUDGET@lite HFS_FUNCTION_BUDGET@full
import assert from "node:assert/strict"
import test from "node:test"
import { Linter, RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { fixtureHfs as declaredHfs } from "./fixtures/typed/tester.mjs"
import plugin, { lawOwners, recommended, ruleDeclarations, ruleOwners, rules as publishedRules } from "./index.mjs"
import { functionLineBudget, rules } from "./function-budget.mjs"

/** A real declared HFS edition; the common parameter is supplied until C08 updates the manifest. */
const fixtureHfs = (edition, max = 80) => {
  const hfs = declaredHfs(undefined, { lite: edition === "lite" })
  return { ...hfs, ruleParams: { ...hfs.ruleParams, functionLines: max } }
}

/** Exactly `count` physical body lines, with comments and blanks making up the interior. */
const body = (count, newline = "\n") => ["{", ...Array.from({ length: count - 2 }, (_, index) => index % 2 === 0 ? "// counted comment" : ""), "}"].join(newline)
const expression = (count) => ["[", ...Array(count - 2).fill("1,"), "]"].join("\n")
const jsx = (count) => ["<section>", ...Array(count - 2).fill("{/* counted JSX comment */}"), "</section>"].join("\n")
const error = (lines, max = 80) => ({ messageId: "lines", data: { lines, max } })
const languageOptions = { parser: tsParser, ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } }

for (const edition of ["lite", "full"]) {
  test(`fe ${edition}: HFS_FUNCTION_BUDGET accepts 80 body lines and refuses 81 across function forms`, () => {
    const hfs = fixtureHfs(edition)
    assert.equal(hfs.edition, edition)
    const tester = new RuleTester({ languageOptions, settings: { starci: { hfs } } })
    tester.run("function-line-budget", functionLineBudget, {
      valid: [
        { code: `function work() ${body(80)}` },
        { code: `const work = function () ${body(80)}` },
        { code: `const work = () => ${body(80)}` },
        { code: `class Worker { work() ${body(80)} }` },
        { code: `const worker = { work() ${body(80)} }` },
        { code: `const work = () => ${expression(80)}` },
        { code: `const work = () => (\n${expression(78)}\n)` },
        { filename: "Card.tsx", code: `const Card = () => ${jsx(80)}` },
        { code: `function outer() {\nfunction inner() ${body(78)}\n}` },
        { code: `function work(\n${Array.from({ length: 90 }, (_, index) => `p${index}: number`).join(",\n")}\n) {}` },
        { code: `${Array(100).fill("// outside the body").join("\n")}\nfunction work() {}` },
        { code: Array.from({ length: 90 }, (_, index) => `function work${index}() {}`).join("\n") },
        { code: "declare function work(): void; interface Worker { work(): void }" },
      ],
      invalid: [
        { code: `function work() ${body(81)}`, errors: [error(81)] },
        { code: `const work = function () ${body(81)}`, errors: [error(81)] },
        { code: `const work = () => ${body(81)}`, errors: [error(81)] },
        { code: `class Worker { work() ${body(81)} }`, errors: [error(81)] },
        { code: `class Worker { constructor() ${body(81)} }`, errors: [error(81)] },
        { code: `class Worker { get value() ${body(81)} }`, errors: [error(81)] },
        { code: `class Worker { set value(value: number) ${body(81)} }`, errors: [error(81)] },
        { code: `const worker = { work() ${body(81)} }`, errors: [error(81)] },
        { code: `function* work() ${body(81)}`, errors: [error(81)] },
        { code: `const work = async () => ${body(81)}`, errors: [error(81)] },
        { code: `const work = () => ${expression(81)}`, errors: [error(81)] },
        { code: `const work = () => (\n${expression(79)}\n)`, errors: [error(81)] },
        { code: `const work = () => (\n${Array(79).fill("// counted comment").join("\n")}\n1)`, errors: [error(81)] },
        { filename: "Card.tsx", code: `const Card = () => ${jsx(81)}`, errors: [error(81)] },
        { code: `function work() ${body(81, "\r\n")}\r\n`, errors: [error(81)] },
        { code: `function outer() {\nconst inner = () => ${body(81)}\n}`, errors: [error(83), error(81)] },
        { filename: "work.spec.ts", code: `function work() ${body(81)}`, errors: [error(81)] },
      ],
    })
  })

  test(`fe ${edition}: HFS_FUNCTION_BUDGET reads the common functionLines parameter`, () => {
    const tester = new RuleTester({ languageOptions, settings: { starci: { hfs: fixtureHfs(edition, 3) } } })
    tester.run("function-line-budget", functionLineBudget, {
      valid: [{ code: `function work() ${body(3)}` }],
      invalid: [{ code: `function work() ${body(4)}`, errors: [error(4, 3)] }],
    })
  })

  test(`fe ${edition}: the append-only registration publishes and activates HFS_FUNCTION_BUDGET`, () => {
    assert.deepEqual(Object.keys(rules), ["function-line-budget"])
    assert.equal(plugin.rules["function-line-budget"], functionLineBudget)
    assert.equal(publishedRules["function-line-budget"], functionLineBudget)
    assert.equal(ruleOwners["function-line-budget"], "function-budget")
    assert.equal(lawOwners.filter((law) => law === "function-budget").length, 1)
    assert.deepEqual(ruleDeclarations.filter(({ name }) => name === "function-line-budget"), [{ law: "function-budget", name: "function-line-budget" }])
    assert.equal(recommended["starci-fe/function-line-budget"], "error")
    const linter = new Linter()
    const messages = linter.verify(`function work() ${body(81)}`, [{
      languageOptions,
      settings: { starci: { hfs: fixtureHfs(edition) } },
      plugins: { "starci-fe": plugin },
      rules: { "starci-fe/function-line-budget": recommended["starci-fe/function-line-budget"] },
    }])
    assert.equal(messages.length, 1)
    assert.equal(messages[0].ruleId, "starci-fe/function-line-budget")
    assert.match(messages[0].message, /HFS_FUNCTION_BUDGET/)
  })
}

test("fe: the owner-decided cap remains active before C08 adds functionLines to the manifest", () => {
  const hfs = fixtureHfs("full")
  delete hfs.ruleParams.functionLines
  const tester = new RuleTester({ languageOptions, settings: { starci: { hfs } } })
  tester.run("function-line-budget", functionLineBudget, {
    valid: [{ code: `function work() ${body(80)}` }],
    invalid: [{ code: `function work() ${body(81)}`, errors: [error(81)] }],
  })
})
