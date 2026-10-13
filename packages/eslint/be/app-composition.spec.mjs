/**
 * Twin tests for the app-composition rules (R245).
 *
 *   node --test app-composition.spec.mjs
 *
 * The fixture app `api` (kind api) holds `api.options.ts`, `app.module.ts`, `main.ts` and the groups of `compose/`.
 */
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { appFileBudget, appOptionsCompositionFree, rules } from "./app-composition.mjs"

const tester = typedTester()
const OPTIONS = at("apps/api/src/api.options.ts")
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

test("<app>.options.ts holds env-derived options and port bindings, never a module, queue or scheduler list", () => {
    tester.run("app-options-composition-free", appOptionsCompositionFree, {
        valid: [
            { filename: OPTIONS, code: "export const parse = (env: { int(key: string): number }) => ({ port: env.int(\"PORT\"), origins: [\"https://a.example\"] })" },
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
        ],
    })
})

test("each composition file stays within the line budget of its app slot", () => {
    tester.run("app-file-budget", appFileBudget, {
        valid: [
            { filename: ROOT, code: lines(250) },
            { filename: OPTIONS, code: lines(200) },
            { filename: GROUP, code: lines(120) },
            { filename: MAIN, code: lines(80) },
            // a file outside the app slots answers to the file budget of HFS_SIZE_GROWTH only
            { filename: MODULE, code: lines(400) },
        ],
        invalid: [
            { filename: ROOT, code: lines(251), errors: [{ messageId: "over" }] },
            { filename: OPTIONS, code: lines(201), errors: [{ messageId: "over" }] },
            { filename: GROUP, code: lines(121), errors: [{ messageId: "over" }] },
            { filename: MAIN, code: lines(81), errors: [{ messageId: "over" }] },
        ],
    })
})
