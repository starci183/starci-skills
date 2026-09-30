import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { at, fixtureHfs } from "./fixtures/typed/tester.mjs"
import { rules, specNoSourceRead } from "./spec-quality.mjs"

const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
    settings: { starci: { hfs: fixtureHfs() } },
})
const SPEC = at("src/modules/domain/plan/plan.service.spec.ts")
const E2E = at("src/tests/e2e/checkout/checkout.e2e-spec.ts")
const SERVICE = at("src/modules/domain/plan/plan.service.ts")

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
            { filename: SERVICE, code: "import { readFileSync } from 'node:fs'\nreadFileSync('src/modules/domain/plan/plan.service.ts')" },
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


test("a spec is judged the same whether it is a unit spec or an e2e spec", () => {
    tester.run("spec-no-source-read", specNoSourceRead, {
        valid: [{ filename: E2E, code: "import { readFileSync } from 'node:fs'\nreadFileSync(join(outputDir, 'receipt.json'))" }],
        invalid: [{ filename: E2E, code: "import { readFileSync } from 'node:fs'\nreadFileSync('src/modules/domain/plan/plan.service.ts')", errors: [{ messageId: "read" }] }],
    })
})

test("a path the slot manifest places in the repository is source, whatever it is called", () => {
    tester.run("spec-no-source-read", specNoSourceRead, {
        valid: [{ filename: SPEC, code: "import { readdirSync } from 'node:fs'\nreaddirSync('tmp/out')" }],
        invalid: [
            { filename: SPEC, code: "import { readdirSync } from 'node:fs'\nreaddirSync('src/modules/domain')", errors: [{ messageId: "read" }] },
            { filename: SPEC, code: "import { readdirSync } from 'node:fs'\nreaddirSync(`./src/features`)", errors: [{ messageId: "read" }] },
            { filename: SPEC, code: "import { readFileSync } from 'node:fs'\nreadFileSync('apps/api/src/main.ts')", errors: [{ messageId: "read" }] },
            { filename: SPEC, code: "import { readFileSync } from 'node:fs'\nreadFileSync('anywhere/config.mjs')", errors: [{ messageId: "read" }] },
        ],
    })
})

test("the cast rules are the factory's borrowed set, not a second copy here", () => {
    assert.deepEqual(Object.keys(rules), ["spec-no-source-read"])
})
