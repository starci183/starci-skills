import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { at, fixtureHfs } from "./fixtures/typed/tester.mjs"
import { fileSizeGrowth, recordedLines } from "./size-budget.mjs"

const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
    settings: { starci: { hfs: fixtureHfs() } },
})
/** The budget is the manifest's (`ruleParams.be.fileLines`); the cases are sized against it. */
const BUDGET = fixtureHfs().ruleParams.fileLines.soft
const lines = (n) => Array.from({ length: n }, (_, i) => `export const v${i} = ${i}`).join("\n") + "\n"

// Probe paths no committed fixture file uses: a committed file would have a recorded size and read as grown.
test("a new file over the manifest budget is refused, in a product file and in a spec alike", () => {
    tester.run("file-size-growth", fileSizeGrowth, {
        valid: [
            { filename: at("src/modules/domain/budget-probe/budget-probe.service.ts"), code: lines(BUDGET) },
            // a declaration file carries no behaviour
            { filename: at("src/modules/domain/budget-probe/types.d.ts"), code: lines(BUDGET + 40) },
            // a migration is append-only
            { filename: at("src/modules/domain/budget-probe/persistence/migrations/1700000000000-init.ts"), code: lines(BUDGET + 40) },
        ],
        invalid: [
            { filename: at("src/modules/domain/budget-probe/budget-probe.service.ts"), code: lines(BUDGET + 1), errors: [{ messageId: "born" }] },
            { filename: at("src/modules/domain/budget-probe/budget-probe.service.spec.ts"), code: lines(BUDGET + 1), errors: [{ messageId: "born" }] },
            { filename: at("src/tests/e2e/budget-probe/budget-probe.e2e-spec.ts"), code: lines(BUDGET + 1), errors: [{ messageId: "born" }] },
            { filename: at("src/tests/fixtures/budget-probe.ts"), code: lines(BUDGET + 1), errors: [{ messageId: "born" }] },
            // a file of the persistence slot that is not a migration is a source file
            { filename: at("src/modules/domain/budget-probe/persistence/budget-probe.sql.ts"), code: lines(BUDGET + 1), errors: [{ messageId: "born" }] },
        ],
    })
})

test("the rule takes no option: a budget or a recorded size cannot be passed", () => {
    assert.deepEqual(fileSizeGrowth.meta.schema, [])
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
    writeFileSync(file, lines(BUDGET + 2))
    git("add", "-A")
    git("commit", "-q", "-m", "seed")
    assert.equal(recordedLines(file), BUDGET + 2)
    assert.equal(recordedLines(join(dir, "src", "new.ts")), null)
    // the working copy is compared with the commit, not with itself: staying put is fine, growing is not
    tester.run("file-size-growth", fileSizeGrowth, {
        valid: [
            { filename: file, code: lines(BUDGET + 2) },
            { filename: file, code: lines(BUDGET + 1) },
        ],
        invalid: [{ filename: file, code: lines(BUDGET + 3), errors: [{ messageId: "grew" }] }],
    })
})
