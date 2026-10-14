/**
 * Twin tests for the app-composition rules (R245/R246).
 *
 *   node --test app-composition.spec.mjs
 *
 * The fixture app `api` (kind api) holds `api.env.ts`, `api.options.ts`, `app.module.ts`, `main.ts` and the groups of `compose/`.
 */
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { appFileBudget, appOptionsCompositionFree, rules } from "./app-composition.mjs"

const tester = typedTester()
const OPTIONS = at("apps/api/src/api.options.ts")
const ENV = at("apps/api/src/api.env.ts")
const ROOT = at("apps/api/src/app.module.ts")
const GROUP = at("apps/api/src/compose/platform.ts")
const MAIN = at("apps/api/src/main.ts")
const MODULE = at("src/modules/domain/plan/plan.module.ts")

/** A source of `count` lines. */
const lines = (count) => `${Array.from({ length: count }, (_, index) => `export const line${index} = ${index}`).join("\n")}\n`

test("every rule this law declares is exported as a rule", () => {
    for (const [name, rule] of Object.entries(rules)) {
        if (!rule?.meta || typeof rule.create !== "function") throw new Error(`${name} is not a rule`)
    }
})

test("<app>.env.ts parses env and <app>.options.ts binds ports, never a module, queue or scheduler list", () => {
    tester.run("app-options-composition-free", appOptionsCompositionFree, {
        valid: [
            { filename: ENV, code: "export interface ApiEnv { readonly port: number }\nexport const readApiEnv = (env: { int(key: string): number }): ApiEnv => ({ port: env.int(\"PORT\") })" },
            { filename: OPTIONS, code: "export interface ApiOptions { readonly port: number }" },
            // a port binding is a provider map: the port names its adapter
            { filename: OPTIONS, code: "class ApprovalGateAdapter {}\nexport const PORTS = { approvalGate: ApprovalGateAdapter }" },
            { filename: OPTIONS, code: "const a = 1\nconst b = 2\nexport const connections = [a, b]" },
            // the same list is composition, and composition lives in compose/ and app.module.ts
            { filename: GROUP, code: "class PlanModule {}\nexport const planModules = [PlanModule]" },
            { filename: ROOT, code: "class PlanModule {}\nexport const m = { imports: [PlanModule] }" },
            { filename: MODULE, code: "class PlanModule {}\nexport const m = { imports: [PlanModule] }" },
        ],
        invalid: [
            { filename: OPTIONS, code: "class PlanModule {}\nexport const modules = [PlanModule]", errors: [{ messageId: "element" }] },
            { filename: OPTIONS, code: "declare const QueueModule: { register(o: object): object }\nexport const list = [QueueModule.register({})]", errors: [{ messageId: "element" }] },
            { filename: OPTIONS, code: "declare const BullModule: { registerQueue(o: object): object }\nexport const queues = [BullModule.registerQueue({ name: \"orders\" })]", errors: [{ messageId: "element" }] },
            { filename: OPTIONS, code: "declare const orderExpirySchedulerOf: (o: object) => object\nexport const entries = [orderExpirySchedulerOf({})]", errors: [{ messageId: "element" }] },
            { filename: OPTIONS, code: "declare const platformModules: object[]\nexport const all = [...platformModules]", errors: [{ messageId: "element" }] },
            { filename: OPTIONS, code: "export const options = { schedulers: [] }", errors: [{ messageId: "list" }] },
            { filename: OPTIONS, code: "class PlanModule {}\nexport const options = { imports: [PlanModule] }", errors: [{ messageId: "list" }] },
            { filename: ENV, code: "class PlanModule {}\nexport const modules = [PlanModule]", errors: [{ messageId: "element" }] },
            { filename: ENV, code: "class PlanModule {}\nexport const modules = [PlanModule as object]", errors: [{ messageId: "element" }] },
            { filename: ENV, code: "class PlanModule {}\nexport const modules = [PlanModule satisfies object]", errors: [{ messageId: "element" }] },
            { filename: ENV, code: "declare const PlanModule: { forRoot(o: object): object }\nexport const modules = [PlanModule.forRoot({})]", errors: [{ messageId: "element" }] },
            { filename: ENV, code: "declare const platformModules: object[]\nexport const all = [...platformModules]", errors: [{ messageId: "element" }] },
            { filename: ENV, code: "export const options = { imports: [] }", errors: [{ messageId: "list" }] },
            // registration also composes when it is outside a list
            { filename: ENV, code: "declare const PlanModule: { register(o: object): object }\nexport const module = PlanModule.register({})", errors: [{ messageId: "call" }] },
            { filename: ENV, code: "declare const PlanModule: { forRoot(o: object): object }\nexport const module = PlanModule.forRoot({})", errors: [{ messageId: "call" }] },
            { filename: ENV, code: "declare const PlanModule: { register(o: object): object }\nexport const module = PlanModule['register']({})", errors: [{ messageId: "call" }] },
            { filename: ENV, code: "declare const PlanModule: { forRoot(o: object): object }\nexport const module = PlanModule['forRoot']({})", errors: [{ messageId: "call" }] },
            { filename: ENV, code: "declare const PlanModule: { register(o: object): object }\nexport const modules = [PlanModule['register']({}) as object]", errors: [{ messageId: "element" }] },
            { filename: ENV, code: "declare const ordersQueue: (o: object) => object\nexport const queue = ordersQueue({})", errors: [{ messageId: "call" }] },
        ],
    })
})

test("each composition file stays within the line budget of its app slot", () => {
    tester.run("app-file-budget", appFileBudget, {
        valid: [
            { filename: ROOT, code: lines(250) },
            { filename: OPTIONS, code: lines(200) },
            { filename: ENV, code: lines(150) },
            { filename: GROUP, code: lines(120) },
            { filename: MAIN, code: lines(80) },
            // a file outside the app slots answers to the file budget of HFS_SIZE_GROWTH only
            { filename: MODULE, code: lines(400) },
        ],
        invalid: [
            { filename: ROOT, code: lines(251), errors: [{ messageId: "over" }] },
            { filename: OPTIONS, code: lines(201), errors: [{ messageId: "over" }] },
            { filename: ENV, code: lines(151), errors: [{ messageId: "over", data: { role: "<app>.env.ts", lines: 151, max: 150, slot: "be.app.api", fix: "Keep typed, fail-fast environment parsing only here; move module composition into `compose/<area>.ts` and business code into its owning module." } }] },
            { filename: GROUP, code: lines(121), errors: [{ messageId: "over" }] },
            { filename: MAIN, code: lines(81), errors: [{ messageId: "over" }] },
        ],
    })
})
