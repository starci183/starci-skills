/**
 * Twin tests for the contract rules.
 *
 *   node --test contract.test.mjs
 *
 * SELF-CONTAINED ON PURPOSE. The rule that reads the table is tested against a fixture written to a
 * temporary directory rather than against whatever repository happens to hold this file, so the
 * suite proves the same thing wherever it is copied. A test that silently passes because the file
 * it was reading is absent is the exact failure these rules exist to prevent - and it has already
 * happened once in the source this was ported from.
 */
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  contractWhyIsAReason,
  noClassCompositionOutsideContract,
  noHandWrittenContractAttrs,
  noLiteralStructuralClass,
  noStructuralHostOutsideContractFrame,
  noUnknownContractKey,
  readContracts,
  rules,
} from "./contract.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

/** A repository whose contract table declares exactly one key, built fresh for this run. */
const fixtureRoot = () => {
  const root = mkdtempSync(join(tmpdir(), "starci-contract-")).replace(/\\/g, "/")
  mkdirSync(join(root, "src/components/contracts"), { recursive: true })
  writeFileSync(
    join(root, "src/components/contracts/index.ts"),
    [
      "export const CONTRACTS = buildContracts({",
      "    \"title-with-baseline-fact\": {",
      "        classes: [\"flex\", \"items-baseline\", \"gap-3\"],",
      "        why: \"the fact sits on the title baseline so a long title pushes it down rather than misaligning\",",
      "    },",
      "})",
      "",
    ].join("\n"),
    "utf8",
  )
  return root
}

const ROOT = fixtureRoot()
const BLOCK = `${ROOT}/src/components/blocks/dashboard/Example/index.tsx`
const COMPOSITE = `${ROOT}/src/components/composites/LabelledProgressRow/index.tsx`
const LEAF = `${ROOT}/src/components/leaves/Text/index.tsx`
const FRAME = `${ROOT}/src/components/branches/Tree/index.tsx`
const TABLE = `${ROOT}/src/components/contracts/index.ts`

test("the path constant still finds a real entry table", () => {
  const contracts = readContracts(BLOCK)
  assert.ok(contracts, "the table above a source file must be readable - a null here silences every rule below")
  assert.deepEqual(contracts.keys, ["title-with-baseline-fact"])
})

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("CONTRACT-1: a structural class written as a literal goes back to a key", () => {
  tester.run("no-literal-structural-class", noLiteralStructuralClass, {
    valid: [
      { filename: BLOCK, code: "export const E = () => <Tree contract=\"title-with-baseline-fact\" />" },
      { filename: BLOCK, code: "export const E = () => <Text className=\"text-sm\" />" },
      { filename: LEAF, code: "export const T = () => <p className=\"inline-flex items-center gap-2\" />" },
    ],
    invalid: [
      {
        filename: BLOCK,
        code: "export const E = () => <Tree className=\"flex gap-4\" />",
        errors: [{ messageId: "structural" }],
      },
      {
        // a composite is NOT exempt: the leaf folder is the only exemption, and widening it is
        // exactly how the leaf tier filled up with arrangements
        filename: COMPOSITE,
        code: "export const C = () => <div className=\"flex flex-col gap-2\" />",
        errors: [{ messageId: "structural" }],
      },
    ],
  })
})

test("CONTRACT-1: hoisting the string into a constant hides it rather than licensing it", () => {
  tester.run("no-literal-structural-class", noLiteralStructuralClass, {
    valid: [
      // not structural - a leaf's own look is none of this rule's business
      { filename: COMPOSITE, code: "const TONE = \"text-sm text-muted\"" },
      // the leaf folder is the one exemption, and it applies to the constant too
      { filename: LEAF, code: "const ROW = \"inline-flex items-center gap-2\"" },
      { filename: COMPOSITE, code: "const LABEL = `already resolved`" },
    ],
    invalid: [
      {
        // the exact shape that survived every rule in the source this was ported from
        filename: COMPOSITE,
        code: "const ROW_CLASSES = \"flex flex-row items-center gap-3 rounded-xl px-3 py-2\"",
        errors: [{ messageId: "hoisted" }],
      },
      {
        filename: BLOCK,
        code: "const SHELL = `flex flex-col gap-4`",
        errors: [{ messageId: "hoisted" }],
      },
    ],
  })
})

test("CONTRACT-2: a class string is never assembled at runtime", () => {
  tester.run("no-class-composition-outside-contract", noClassCompositionOutsideContract, {
    valid: [
      { filename: BLOCK, code: "export const E = () => <Tree contract={t ? \"rows-tight\" : \"rows\"} />" },
      { filename: LEAF, code: "export const T = () => <p className={cn(\"a\", \"b\")} />" },
    ],
    invalid: [
      {
        filename: BLOCK,
        code: "export const E = () => <Tree className={cn(\"flex\", on && \"gap-4\")} />",
        errors: [{ messageId: "composer" }],
      },
      {
        filename: BLOCK,
        code: "export const E = () => <Tree className={`flex ${extra}`} />",
        errors: [{ messageId: "interpolated" }],
      },
    ],
  })
})

test("CONTRACT-6: a reason that restates the key is not a reason", () => {
  tester.run("contract-why-is-a-reason", contractWhyIsAReason, {
    valid: [
      {
        filename: TABLE,
        code: "const C = { \"title-with-baseline-fact\": { why: \"the fact sits on the title baseline so a long title pushes it down rather than misaligning it\" } }",
      },
      { filename: BLOCK, code: "const C = { \"x\": { why: \"row of chips\" } }" },
    ],
    invalid: [
      {
        filename: TABLE,
        code: "const C = { \"content-row\": { why: \"row of chips\" } }",
        errors: [{ messageId: "tooShort" }],
      },
      {
        filename: TABLE,
        code: "const C = { \"title-with-baseline-fact\": { why: \"title with baseline fact title with baseline fact title with baseline fact\" } }",
        errors: [{ messageId: "restates" }],
      },
    ],
  })
})

test("CONTRACT-7: a structural host outside the frame is a node with no key", () => {
  tester.run("no-structural-host-outside-contract-frame", noStructuralHostOutsideContractFrame, {
    valid: [
      { filename: BLOCK, code: "export const E = () => <Tree contract=\"title-with-baseline-fact\" />" },
      { filename: FRAME, code: "export const Tree = () => <div />" },
      { filename: FRAME, code: "export const Tree = () => <ul />" },
      { filename: LEAF, code: "export const T = () => <div />" },
      { filename: BLOCK, code: "export const E = () => <span />" },
      // a semantic element carrying MEANING and no shape: it decides nothing, and swapping it for
      // a neutral box would change what assistive technology reports
      { filename: BLOCK, code: "export const E = () => <form onSubmit={submit}><Tree contract=\"form-column\" /></form>" },
      { filename: COMPOSITE, code: "export const C = () => <ul><li /></ul>" },
    ],
    invalid: [
      { filename: BLOCK, code: "export const E = () => <div />", errors: [{ messageId: "host" }] },
      { filename: BLOCK, code: "export const E = () => <section />", errors: [{ messageId: "host" }] },
      // a semantic element the moment it carries a shape
      {
        filename: COMPOSITE,
        code: "export const C = () => <ul className=\"flex gap-2\" />",
        errors: [{ messageId: "styledSemantic" }],
      },
      {
        filename: BLOCK,
        code: "export const E = () => <form className=\"flex flex-col\" />",
        errors: [{ messageId: "styledSemantic" }],
      },
    ],
  })
})

test("CONTRACT-8: a marker written by hand claims a contract nothing holds", () => {
  tester.run("no-hand-written-contract-attrs", noHandWrittenContractAttrs, {
    valid: [
      { filename: FRAME, code: "export const Tree = () => <div data-node=\"x\" />" },
      { filename: BLOCK, code: "export const E = () => <Tree contract=\"title-with-baseline-fact\" />" },
    ],
    invalid: [
      {
        filename: BLOCK,
        code: "export const E = () => <Tree data-node=\"title-with-baseline-fact\" />",
        errors: [{ messageId: "marker" }],
      },
    ],
  })
})

test("CONTRACT-9: an unknown key describes nothing, and the message lists the real ones", () => {
  tester.run("no-unknown-contract-key", noUnknownContractKey, {
    valid: [{ filename: BLOCK, code: "export const E = () => <Tree contract=\"title-with-baseline-fact\" />" }],
    invalid: [
      { filename: BLOCK, code: "export const E = () => <Tree contract=\"card\" />", errors: [{ messageId: "unknown" }] },
      { filename: BLOCK, code: "const spec = contractSpec(\"card\")", errors: [{ messageId: "unknown" }] },
    ],
  })
})

test("a table that cannot be read silences the rule instead of failing every call site", () => {
  const orphan = mkdtempSync(join(tmpdir(), "starci-orphan-")).replace(/\\/g, "/")
  assert.equal(readContracts(`${orphan}/src/components/blocks/x/Y/index.tsx`), null)
  tester.run("no-unknown-contract-key", noUnknownContractKey, {
    valid: [
      { filename: `${orphan}/src/components/blocks/x/Y/index.tsx`, code: "const E = () => <Tree contract=\"anything\" />" },
    ],
    invalid: [],
  })
})
