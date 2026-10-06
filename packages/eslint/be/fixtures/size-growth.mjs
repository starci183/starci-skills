/**
 * The shared spec of the size-growth law's side twins (be size-budget.spec.mjs, fe size-growth.spec.mjs): the
 * assertions both sides make against their own fileSizeGrowth module. A side prefixes every title with its name.
 * The per-side first cases (which paths the slots exempt) stay in each spec, where the RuleTester run also proves
 * the law to the rule catalog.
 */
import assert from "node:assert/strict"
import { runGit } from "../runtime/scripts/api/git/lib.mjs"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { recordedLines } from "../runtime/scripts/api/git/recorded-lines.mjs"

/** `count` lines of inert exports. */
export const lines = (count) => Array.from({ length: count }, (_, index) => `export const v${index} = ${index}`).join("\n") + "\n"

/** Register the shared size-growth assertions against one side's rule and tester. */
export function sizeGrowthSharedSpec({ side, tester, fileSizeGrowth, budget, fileName = "big.ts" }) {
  test(`${side}: the rule takes no option - a budget or a recorded size cannot be passed`, () => {
    assert.deepEqual(fileSizeGrowth.meta.schema, [])
  })

  test(`${side}: the recorded size is the file's line count at the parent commit`, (t) => {
    const dir = mkdtempSync(join(tmpdir(), `starci-${side}-size-`))
    t.after(() => rmSync(dir, { recursive: true, force: true }))
    const git = (...args) => {
      const run = runGit(args, { dir, config: { "user.email": "t@example.com", "user.name": "t" } })
      if (run.error || run.status !== 0) throw run.error ?? new Error(`git ${args[0]} exited ${run.status}: ${run.stderr}`)
    }
    try {
      git("init", "-q")
    } catch {
      t.skip("git is not available")
      return
    }
    mkdirSync(join(dir, "src"))
    const file = join(dir, "src", fileName)
    writeFileSync(file, lines(budget + 2))
    git("add", "-A")
    git("commit", "-q", "-m", "seed")
    assert.equal(recordedLines(file), budget + 2)
    assert.equal(recordedLines(join(dir, "src", `new${fileName.slice(fileName.lastIndexOf("."))}`)), null)
    // the working copy is compared with the commit, not with itself: staying put is fine, growing is not
    tester.run("file-size-growth", fileSizeGrowth, {
      valid: [
        { filename: file, code: lines(budget + 2) },
        { filename: file, code: lines(budget + 1) },
      ],
      invalid: [{ filename: file, code: lines(budget + 3), errors: [{ messageId: "grew" }] }],
    })
  })
}
