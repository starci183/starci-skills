/**
 * Twin tests for the size-growth law (HFS R20 `HFS_SIZE_GROWTH`).
 *
 *   node --test size-growth.test.mjs
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { fixtureHfs } from "./fixtures/typed/tester.mjs"
import { fileSizeGrowth, rules } from "./size-growth.mjs"
import { recordedLines } from "./runtime/scripts/api/git/recorded-lines.mjs"

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
const lines = (count) => Array.from({ length: count }, (_, index) => `export const v${index} = ${index}`).join("\n") + "\n"

test("the parameters come from the shipped manifest, and the law declares its one rule", () => {
  assert.ok(Number.isInteger(BUDGET) && BUDGET > 0)
  assert.equal(feParams.fileLines.hardGrowth, true)
  assert.deepEqual(Object.keys(rules), ["file-size-growth"])
})

test("a new file over the manifest budget is refused, in a component and a hook alike", () => {
  tester.run("file-size-growth", fileSizeGrowth, {
    valid: [
      { filename: "D:/repo/src/components/Card/index.tsx", code: lines(BUDGET) },
      // a declaration file carries no behaviour
      { filename: "D:/repo/src/types/wire.d.ts", code: lines(BUDGET + 40) },
    ],
    invalid: [
      { filename: "D:/repo/src/components/Card/index.tsx", code: lines(BUDGET + 1), errors: [{ messageId: "born" }] },
      { filename: "D:/repo/src/hooks/useFeed.ts", code: lines(BUDGET + 1), errors: [{ messageId: "born" }] },
    ],
  })
})

test("the rule takes no option: a budget or a recorded size cannot be passed", () => {
  assert.deepEqual(fileSizeGrowth.meta.schema, [])
})

test("the recorded size is the file's line count at the parent commit", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "starci-fe-size-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const git = (...args) => execFileSync("git", ["-C", dir, "-c", "user.email=t@example.com", "-c", "user.name=t", ...args], { stdio: "ignore" })
  try {
    git("init", "-q")
  } catch {
    t.skip("git is not available")
    return
  }
  mkdirSync(join(dir, "src"))
  const file = join(dir, "src", "Big.tsx")
  writeFileSync(file, lines(BUDGET + 2))
  git("add", "-A")
  git("commit", "-q", "-m", "seed")
  assert.equal(recordedLines(file), BUDGET + 2)
  assert.equal(recordedLines(join(dir, "src", "New.tsx")), null)
  // the working copy is compared with the commit, not with itself: staying put is fine, growing is not
  tester.run("file-size-growth", fileSizeGrowth, {
    valid: [
      { filename: file, code: lines(BUDGET + 2) },
      { filename: file, code: lines(BUDGET + 1) },
    ],
    invalid: [{ filename: file, code: lines(BUDGET + 3), errors: [{ messageId: "grew" }] }],
  })
})
