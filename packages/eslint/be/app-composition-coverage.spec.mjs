// proves: BE_APP_OPTIONS_COMPOSITION@lite BE_APP_OPTIONS_COMPOSITION@full
// proves: BE_APP_COMPOSITION_BUDGET@lite BE_APP_COMPOSITION_BUDGET@full
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { appOptionsCompositionFree, appFileBudget } from "./app-composition.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { at, BE_DECLARATION, TYPED_ROOT } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"

const env = at("apps/api/src/api.env.ts")
const options = at("apps/api/src/api.options.ts")
const group = at("apps/api/src/compose/platform.ts")
const root = at("apps/api/src/app.module.ts")
const main = at("apps/api/src/main.ts")
const sourceLines = (count) => Array.from({ length: count }, () => "export {};").join("\n") + "\n"

for (const edition of ["lite", "full"]) {
    const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
    const tester = new RuleTester({
        languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
        settings: { starci: { hfs } },
    })

    test(`R245 accepts role-specific values and rejects composition in env and options in ${edition}`, () => {
        tester.run("app-options-composition-free", appOptionsCompositionFree, {
            valid: [
                { filename: env, code: 'export const readApiEnv = (env: { int(key: string): number }) => ({ port: env.int("PORT") })' },
                { filename: options, code: "class ApprovalAdapter {}\nexport const ports = { approvalGate: ApprovalAdapter }" },
                { filename: group, code: "class CoreModule {}\nexport const platformModules = [CoreModule]" },
                { filename: root, code: "class CoreModule {}\nexport const metadata = { imports: [CoreModule] }" },
            ],
            invalid: [
                { filename: env, code: "class CoreModule {}\nexport const modules = [CoreModule]", errors: [{ messageId: "element" }] },
                { filename: options, code: "class CoreModule {}\nexport const modules = [CoreModule]", errors: [{ messageId: "element" }] },
                { filename: options, code: "export const options = { schedulers: [] }", errors: [{ messageId: "list" }] },
                { filename: env, code: "declare const QueueModule: { registerQueue(o: object): object }\nexport const queue = QueueModule.registerQueue({})", errors: [{ messageId: "call" }] },
            ],
        })
    })

    test(`R246 accepts exact budgets and rejects one extra line for each app role in ${edition}`, () => {
        tester.run("app-file-budget", appFileBudget, {
            valid: [
                { filename: main, code: sourceLines(80) },
                { filename: env, code: sourceLines(150) },
                { filename: options, code: sourceLines(200) },
                { filename: group, code: sourceLines(120) },
                { filename: root, code: sourceLines(250) },
            ],
            invalid: [
                { filename: main, code: sourceLines(81), errors: [{ messageId: "over" }] },
                { filename: env, code: sourceLines(151), errors: [{ messageId: "over" }] },
                { filename: options, code: sourceLines(201), errors: [{ messageId: "over" }] },
                { filename: group, code: sourceLines(121), errors: [{ messageId: "over" }] },
                { filename: root, code: sourceLines(251), errors: [{ messageId: "over" }] },
            ],
        })
    })
}
