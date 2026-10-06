import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noInlineSuppression } from "./suppression.mjs"

const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
    linterOptions: { noInlineConfig: true },
})
/** ESLint itself reports a directive it ignores under noInlineConfig; that notice is not this rule's finding. */
const NOTICE = { message: /noInlineConfig/ }
const FILE = "src/modules/domain/plan/plan.service.ts"
const SPEC = "src/modules/domain/plan/plan.service.spec.ts"

test("no comment switches a check off at the place it is written", () => {
    tester.run("no-inline-suppression", noInlineSuppression, {
        valid: [
            { filename: FILE, code: "// this explains why the retry exists\nconst a = 1" },
            { filename: FILE, code: "// the disabled flag is read here\nconst a = 1" },
            { filename: FILE, code: "// the global registry lives in the platform module\nconst a = 1" },
            { filename: FILE, code: "// coverage is measured by the runner, the estimate ignores nothing\nconst a = 1" },
            { filename: FILE, code: "// the formatter runs before commit\nconst a = 1" },
        ],
        invalid: [
            { filename: FILE, code: "// eslint-disable-next-line no-console\nconsole.log(1)", errors: [NOTICE, { messageId: "eslint" }] },
            { filename: FILE, code: "console.log(1) // eslint-disable-line", errors: [NOTICE, { messageId: "eslint" }] },
            { filename: FILE, code: "/* eslint-disable */\nconst a = 1", errors: [NOTICE, { messageId: "eslint" }] },
            { filename: FILE, code: "/* eslint-disable starci-be/error-home */\nconst a = 1", errors: [NOTICE, { messageId: "eslint" }] },
            { filename: FILE, code: "const a = 1\n/* eslint-enable */", errors: [NOTICE, { messageId: "eslint" }] },
            { filename: FILE, code: "/* eslint no-console: off */\nconst a = 1", errors: [NOTICE, { messageId: "eslint" }] },
            { filename: FILE, code: "/* eslint-env node */\nconst a = 1", errors: [NOTICE, { messageId: "eslint" }] },
            { filename: FILE, code: "/* global window */\nconst a = 1", errors: [NOTICE, { messageId: "eslint" }] },
            { filename: FILE, code: "/* globals window, document */\nconst a = 1", errors: [NOTICE, { messageId: "eslint" }] },
            { filename: FILE, code: "// @ts-ignore\nconst a: number = 'x'", errors: [{ messageId: "typescript" }] },
            { filename: FILE, code: "// @ts-expect-error probing\nconst a: number = 'x'", errors: [{ messageId: "typescript" }] },
            { filename: FILE, code: "// @ts-nocheck\nconst a = 1", errors: [{ messageId: "typescript" }] },
            // a directive is a directive wherever it sits in the comment
            { filename: FILE, code: "// the reason: @ts-ignore hides this\nconst a: number = 'x'", errors: [{ messageId: "typescript" }] },
            { filename: FILE, code: "const a: number = 'x' // note @ts-expect-error", errors: [{ messageId: "typescript" }] },
            { filename: SPEC, code: "// @ts-ignore\nconst a: number = 'x'", errors: [{ messageId: "typescript" }] },
            { filename: FILE, code: "/* istanbul ignore next */\nconst a = 1", errors: [{ messageId: "coverage" }] },
            { filename: FILE, code: "/* c8 ignore start */\nconst a = 1", errors: [{ messageId: "coverage" }] },
            { filename: FILE, code: "/* v8 ignore next */\nconst a = 1", errors: [{ messageId: "coverage" }] },
            { filename: FILE, code: "// v8 ignore next\nconst a = 1", errors: [{ messageId: "coverage" }] },
            { filename: FILE, code: "const a = 1 // NOSONAR", errors: [{ messageId: "sonar" }] },
            { filename: FILE, code: "// sonar-disable-next-line\nconst a = 1", errors: [{ messageId: "sonar" }] },
            { filename: FILE, code: "// prettier-ignore\nconst a   =   1", errors: [{ messageId: "prettier" }] },
        ],
    })
})
