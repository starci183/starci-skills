import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { at, fixtureHfs } from "./fixtures/typed/tester.mjs"
import { fileSizeGrowth } from "./size-budget.mjs"
import { lines, sizeGrowthSharedSpec } from "./fixtures/size-growth.mjs"

const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
    settings: { starci: { hfs: fixtureHfs() } },
})
/** The budget is the manifest's (`ruleParams.be.fileLines`); the cases are sized against it. */
const BUDGET = fixtureHfs().ruleParams.fileLines.soft

// Probe paths no committed fixture file uses: a committed file would have a recorded size and read as grown.
test("be: a new file over the manifest budget is refused, in a product file and in a spec alike", () => {
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

sizeGrowthSharedSpec({ side: "be", tester, fileSizeGrowth, budget: BUDGET, fileName: "big.ts" })
