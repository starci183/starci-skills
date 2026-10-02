/**
 * Twin tests for the size-growth law (HFS R20 `HFS_SIZE_GROWTH`).
 *
 *   node --test size-growth.spec.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { fixtureHfs } from "./fixtures/typed/tester.mjs"
import { fileSizeGrowth, rules } from "./size-growth.mjs"
import { lines, sizeGrowthSharedSpec } from "../be/fixtures/size-growth.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  settings: { starci: { hfs: fixtureHfs() } },
})

/** The front-end parameters the rule reads through the slot view. */
const feParams = fixtureHfs().ruleParams

/** The budget is the manifest's (`ruleParams.fe.fileLines`); the cases are sized against it. */
const BUDGET = feParams.fileLines.soft

test("fe: the parameters come from the shipped manifest, and the law declares its one rule", () => {
  assert.ok(Number.isInteger(BUDGET) && BUDGET > 0)
  assert.equal(feParams.fileLines.hardGrowth, true)
  assert.deepEqual(Object.keys(rules), ["file-size-growth"])
})

test("fe: a new file over the manifest budget is refused, in a component and a hook alike", () => {
  tester.run("file-size-growth", fileSizeGrowth, {
    valid: [
      { filename: "repo/src/components/Card/index.tsx", code: lines(BUDGET) },
      // a declaration file carries no behaviour
      { filename: "repo/src/types/wire.d.ts", code: lines(BUDGET + 40) },
    ],
    invalid: [
      { filename: "repo/src/components/Card/index.tsx", code: lines(BUDGET + 1), errors: [{ messageId: "born" }] },
      { filename: "repo/src/hooks/useFeed.ts", code: lines(BUDGET + 1), errors: [{ messageId: "born" }] },
    ],
  })
})

sizeGrowthSharedSpec({ side: "fe", tester, fileSizeGrowth, budget: BUDGET, fileName: "Big.tsx" })
