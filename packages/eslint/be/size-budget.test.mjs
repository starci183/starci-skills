import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { fileSizeGrowth, fileSizeSoftLimit, recordedLines } from "./size-budget.mjs"

const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const SERVICE = "D:/repo/src/modules/domain/plan/plan.service.ts"
const lines = (n) => Array.from({ length: n }, (_, i) => `export const v${i} = ${i}`).join("\n") + "\n"

test("a file over the soft budget is shown, a file within it is not", () => {
    tester.run("file-size-soft-limit", fileSizeSoftLimit, {
        valid: [
            { filename: SERVICE, options: [{ max: 5 }], code: lines(5) },
            { filename: "D:/repo/src/modules/domain/plan/plan.service.spec.ts", options: [{ max: 2 }], code: lines(9) },
            {
                filename: "D:/repo/src/modules/domain/plan/persistence/migrations/20260929120000-baseline.ts",
                options: [{ max: 2 }],
                code: lines(9),
            },
            { filename: "D:/repo/src/modules/domain/plan/plan.d.ts", options: [{ max: 2 }], code: lines(9) },
        ],
        invalid: [{ filename: SERVICE, options: [{ max: 5 }], code: lines(6), errors: [{ messageId: "over" }] }],
    })
})

test("a file over the budget is not born large and does not grow", () => {
    const recorded = (n) => ({ max: 5, recorded: { "src/modules/domain/plan/plan.service.ts": n } })
    tester.run("file-size-growth", fileSizeGrowth, {
        valid: [
            { filename: SERVICE, options: [recorded(9)], code: lines(8) },
            { filename: SERVICE, options: [recorded(9)], code: lines(9) },
            { filename: SERVICE, options: [{ max: 5 }], code: lines(5) },
            { filename: "D:/repo/src/tests/e2e/plan/plan.e2e-spec.ts", options: [{ max: 2 }], code: lines(9) },
        ],
        invalid: [
            { filename: SERVICE, options: [{ max: 5 }], code: lines(6), errors: [{ messageId: "born" }] },
            { filename: SERVICE, options: [recorded(9)], code: lines(10), errors: [{ messageId: "grew" }] },
            // crossing the budget from below is growth past a recorded size too
            { filename: SERVICE, options: [recorded(4)], code: lines(6), errors: [{ messageId: "grew" }] },
        ],
    })
})

test("the recorded size is the file's line count at the parent commit", (t) => {
    const dir = mkdtempSync(join(tmpdir(), "starci-size-"))
    const git = (...args) => execFileSync("git", ["-C", dir, "-c", "user.email=t@example.com", "-c", "user.name=t", ...args], { stdio: "ignore" })
    try {
        git("init", "-q")
    } catch {
        t.skip("git is not available")
        return
    }
    mkdirSync(join(dir, "src"))
    const file = join(dir, "src", "big.ts")
    writeFileSync(file, lines(7))
    git("add", "-A")
    git("commit", "-q", "-m", "seed")
    assert.equal(recordedLines(file), 7)
    assert.equal(recordedLines(join(dir, "src", "new.ts")), null)
    // the working copy has grown; the rule compares it with the commit, not with itself
    tester.run("file-size-growth", fileSizeGrowth, {
        valid: [{ filename: file, options: [{ max: 5 }], code: lines(7) }],
        invalid: [{ filename: file, options: [{ max: 5 }], code: lines(8), errors: [{ messageId: "grew" }] }],
    })
})
