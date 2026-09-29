import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { specNoSourceRead, specTypedDoubles } from "./spec-quality.mjs"

const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const SPEC = "D:/repo/src/modules/domain/plan/plan.service.spec.ts"
const SERVICE = "D:/repo/src/modules/domain/plan/plan.service.ts"

test("a spec does not read the repository's source files", () => {
    tester.run("spec-no-source-read", specNoSourceRead, {
        valid: [
            { filename: SPEC, code: "import { readFileSync } from 'node:fs'\nconst x = 1" },
            { filename: SPEC, code: "import { writeFileSync } from 'node:fs'\nwriteFileSync('a', 'b')" },
            { filename: SPEC, code: "import path from 'node:path'\npath.join('a')" },
            // reading what the subject wrote to a temporary directory is behavior, not source
            { filename: SPEC, code: "import { readFile } from 'node:fs/promises'\nconst target = makeTmp()\nawait readFile(join(target, 'out.json'))" },
            { filename: SPEC, code: "import fs from 'node:fs'\nfs.readdirSync(outputDir)" },
            // production code may read files; this rule judges specs
            { filename: SERVICE, code: "import { readFileSync } from 'node:fs'\nreadFileSync('src/a.ts')" },
        ],
        invalid: [
            { filename: SPEC, code: "import { readFileSync } from 'node:fs'\nreadFileSync('src/a.ts', 'utf8')", errors: [{ messageId: "read" }] },
            { filename: SPEC, code: "import fs from 'node:fs'\nfs.readdirSync('src')", errors: [{ messageId: "read" }] },
            { filename: SPEC, code: "import * as fs from 'fs'\nfs.readFileSync(join(__dirname, 'plan.service.ts'))", errors: [{ messageId: "read" }] },
            { filename: SPEC, code: "import { promises as fs } from 'node:fs'\nawait fs.readFile(join(process.cwd(), 'x'))", errors: [{ messageId: "read" }] },
            { filename: SPEC, code: "import { readFile } from 'node:fs/promises'\nawait readFile(new URL('./plan.service.ts', import.meta.url))", errors: [{ messageId: "read" }] },
            { filename: SPEC, code: "import fs from 'node:fs'\nfs.promises.readFile('apps/api/src/main.ts')", errors: [{ messageId: "read" }] },
            // an identifier is followed to its initializer
            {
                filename: SPEC,
                code: "import { readdirSync } from 'node:fs'\nconst directory = join(__dirname, 'referral')\nreaddirSync(directory)",
                errors: [{ messageId: "read" }],
            },
        ],
    })
})

test("a double is a typed mock, never a cast", () => {
    tester.run("spec-typed-doubles", specTypedDoubles, {
        valid: [
            { filename: SPEC, code: "const repo = mock<PlanRepository>()" },
            { filename: SPEC, code: "const x = value as PlanSummary" },
            { filename: SPEC, code: "const x = value as unknown" },
            // production code is judged by no-double-cast, not by this rule
            { filename: SERVICE, code: "const x = value as never" },
        ],
        invalid: [
            { filename: SPEC, code: "const repo = {} as never", errors: [{ messageId: "never" }] },
            { filename: SPEC, code: "const repo = fake as unknown as PlanRepository", errors: [{ messageId: "doubleCast" }] },
            { filename: "D:/repo/src/tests/fixtures/plan.ts", code: "export const p = {} as never", errors: [{ messageId: "never" }] },
        ],
    })
})
