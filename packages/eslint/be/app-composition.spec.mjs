/**
 * Tests for the app-composition rules (R245/R246/R265).
 *
 *   node --test app-composition.spec.mjs
 *
 * The fixture app `api` (kind api) holds `api.env.ts`, `api.options.ts`, `app.module.ts`, `main.ts` and the groups of `compose/`.
 */
import test from "node:test"
// proves: BE_COMPOSITION_UNTYPED@lite BE_COMPOSITION_UNTYPED@full
// proves: BE_APP_ENV_REQUIRED@lite BE_APP_ENV_REQUIRED@full BE_APP_MODULE_LIST_INLINE@lite BE_APP_MODULE_LIST_INLINE@full
// proves: BE_APP_BUSINESS_ROLE@lite BE_APP_BUSINESS_ROLE@full
import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import tsParser from "@typescript-eslint/parser"
import { appDeclaration } from "./fixtures/app.mjs"
import { at, BE_DECLARATION, ruleTester, TYPED_ROOT, typedTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { appCompositionTyped, appEnvRequired, appFileBudget, appModuleListInline, appOptionsCompositionFree, rules } from "./app-composition.mjs"

const tester = typedTester()
const OPTIONS = at("apps/api/src/api.options.ts")
const ENV = at("apps/api/src/api.env.ts")
const ROOT = at("apps/api/src/app.module.ts")
const GROUP = at("apps/api/src/compose/platform.ts")
const MAIN = at("apps/api/src/main.ts")
const MODULE = at("src/modules/domain/plan/plan.module.ts")

/** Env-role cases replace an imported file; each case must start from the on-disk fixture graph. */
const isolatedCases = (cases) => Object.fromEntries(Object.entries(cases).map(([kind, fixtures]) => [
    kind, fixtures.map((fixture) => ({ ...fixture, before: () => tsParser.clearCaches() })),
]))

/** A source of `count` lines. */
const lines = (count) => `${Array.from({ length: count }, (_, index) => `export const line${index} = ${index}`).join("\n")}\n`

test("every rule this law declares is exported as a rule", () => {
    for (const [name, rule] of Object.entries(rules)) {
        if (!rule?.meta || typeof rule.create !== "function") throw new Error(`${name} is not a rule`)
    }
})

test("composition findings carry machine-code prefixes for the HFS lint runner", () => {
    const expected = [
        [appCompositionTyped, { outside: "BE_COMPOSITION_UNTYPED", group: "BE_COMPOSITION_UNTYPED", business: "BE_APP_BUSINESS_ROLE" }],
        [appEnvRequired, { shape: "BE_APP_ENV_REQUIRED", inline: "BE_APP_ENV_REQUIRED", delegate: "BE_APP_ENV_REQUIRED" }],
        [appModuleListInline, { inline: "BE_APP_MODULE_LIST_INLINE" }],
    ]
    for (const [rule, codes] of expected) {
        for (const [message, code] of Object.entries(codes)) assert.ok(rule.meta.messages[message].startsWith(`[${code}] `))
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

/** These augment the fixture's Nest stubs with the real composition contracts, without changing shared fixtures. */
const contracts = `
import { Module } from "@nestjs/common"
import type { Type, DynamicModule, Provider } from "@nestjs/common"
declare module "@nestjs/common" {
    interface Type<T = unknown> { new (...args: unknown[]): T }
    interface DynamicModule { module: Type<unknown>; imports?: Array<Type<unknown> | DynamicModule>; providers?: Provider[] }
    type Provider = Type<unknown> | { provide: string | symbol; useClass: Type<unknown> } | { provide: string | symbol; useValue: unknown }
}
interface Schedule { readonly queue: string; readonly id: string; readonly everyMs: number }
interface QueueSchedulerDefinition { readonly queue: string; readonly id: string; readonly everyMs: number }
`

for (const edition of ["lite", "full"]) {
    test(`R265 refuses all seven composition bypasses and accepts typed groups in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        const typed = ruleTester({ root: TYPED_ROOT, hfs })
        const example = (filename, code, messageId) => ({
            filename,
            code: `${contracts}\n${code}`,
            ...(messageId ? { errors: [{ messageId }] } : {}),
        })
        typed.run("app-composition-typed", appCompositionTyped, {
            valid: [
                example(ENV, `export interface ApiEnv { readonly allowedOrigins: string[]; readonly everyMs: number }
export const readApiEnv = (env: { strings(key: string): string[]; int(key: string): number }): ApiEnv => ({
    allowedOrigins: env.strings("ORIGINS"), everyMs: env.int("TICK_MS"),
})`),
                example(ENV, 'export const labels = { names: ["api", "worker"], intervals: [1000, 2000] }'),
                example(OPTIONS, `class ApprovalAdapter {}
export const PORTS = { approvalGate: ApprovalAdapter }
export interface ApiOptions { readonly everyMs: number; readonly names: readonly string[] }`),
                example(OPTIONS, `class Adapter {}
export const bindPorts = () => ({ approvalGate: Adapter })`),
                example(OPTIONS, `class Adapter {}
export const ports: Record<string, typeof Adapter> = { approvalGate: Adapter }`),
                example(MAIN, `import { NestFactory } from "@nestjs/core"
declare module "@nestjs/core" {
    const NestFactory: { create(module: DynamicModule | Type<unknown>, options?: object): Promise<{ listen(port: number): Promise<void> }> }
}
declare const Root: { register(): DynamicModule }
const bootstrap = async (): Promise<void> => {
    const app = await NestFactory.create(Root.register(), { rawBody: true })
    await app.listen(3000)
}
bootstrap()`),
                example(ROOT, '@Module({}) class Core {}\nexport const metadata = { imports: [Core] }'),
                example(MODULE, '@Module({}) class Core {}\nexport const metadata = { imports: [Core] }'),
                example(GROUP, `@Module({}) class Core {}
export const area = (): Array<Type<unknown> | DynamicModule> => [Core]`),
                example(GROUP, `class Core {}
export const area: Array<Type<unknown> | DynamicModule> = [Core]`),
                example(GROUP, `class Core {}
export function area(): ReadonlyArray<Type<unknown> | DynamicModule> { return [Core] }`),
                example(GROUP, `class Core {}
export const area: () => Array<Type<unknown> | DynamicModule> = () => [Core]`),
                example(GROUP, `class Core {}
export const area = [Core] satisfies Array<Type<unknown> | DynamicModule>`),
                example(GROUP, `class Core {}
const area: Array<Type<unknown> | DynamicModule> = [Core]
export { area as domain }`),
                example(GROUP, `class Core {}
export default function area(): Array<Type<unknown> | DynamicModule> { return [Core] }`),
                example(GROUP, `class Adapter {}
export const ports: Provider[] = [{ provide: "APPROVAL", useClass: Adapter }]`),
                example(GROUP, 'export const schedules: Schedule[] = [{ queue: "billing", id: "tick", everyMs: 1000 }]'),
                example(GROUP, 'export const schedules: ReadonlyArray<QueueSchedulerDefinition> = [{ queue: "billing", id: "tick", everyMs: 1000 }]'),
            ],
            invalid: [
                // CE1: a renamed module still has its decorated constructor type.
                example(OPTIONS, '@Module({}) class DomainCore {}\nexport const list = [DomainCore]', "outside"),
                example(OPTIONS, 'import { CatalogModule as Entry } from "@modules/domain/catalog"\nexport const list = [Entry]', "outside"),
                // CE2: object maps and nested maps resolve their module types too.
                example(OPTIONS, '@Module({}) class Core {}\nexport const modules = { domain: Core }', "outside"),
                example(ENV, '@Module({}) class Core {}\nexport const modules = { nested: { domain: Core } }', "outside"),
                example(OPTIONS, 'declare const modules: Record<string, Type<unknown>>\nexport const map = modules', "outside"),
                example(OPTIONS, '@Module({}) class Core {}\nexport const map: Record<string, typeof Core> = { domain: Core }', "outside"),
                // CE3: a helper's return type identifies its composition, without a naming convention.
                example(OPTIONS, '@Module({}) class Core {}\nexport const capabilities = () => [Core]', "outside"),
                example(ENV, 'declare const capabilities: () => Type<unknown>[]\nexport const all = [...capabilities()]', "outside"),
                // CE4: configure is a registration because it returns a DynamicModule.
                example(OPTIONS, 'declare const wiring: { configure(): DynamicModule }\nexport const module = wiring.configure()', "outside"),
                example(ENV, 'declare const wiring: { configure(): DynamicModule }\nexport const module = wiring["configure"]()', "outside"),
                example(ENV, 'declare const wiring: { configure(): DynamicModule }\nconst saved = wiring.configure()', "outside"),
                example(OPTIONS, 'declare const saved: DynamicModule\nexport const modules = [saved]', "outside"),
                // CE5: defineQueues is judged by the entries it returns.
                example(OPTIONS, 'declare const defineQueues: () => DynamicModule[]\nexport const queues = defineQueues()', "outside"),
                example(ENV, 'declare const defineQueues: () => Schedule[]\nexport const queues = defineQueues()', "outside"),
                // CE6: a plain cron table is typed structurally, even without a helper call.
                example(OPTIONS, 'export const table = { billing: { queue: "billing", cron: "* * * * *" } }', "outside"),
                example(ENV, 'export const table = { billing: { queue: "billing", id: "tick", everyMs: 1000 } }', "outside"),
                example(OPTIONS, 'declare const ticks: ReadonlyArray<QueueSchedulerDefinition>\nexport const table = ticks', "outside"),
                example(MAIN, 'const ticks: ReadonlyArray<QueueSchedulerDefinition> = [{ queue: "billing", id: "tick", everyMs: 1000 }]', "outside"),
                // CE7: bootstrap lists are composition too.
                example(MAIN, '@Module({}) class Core {}\nexport const dependencies = [Core]', "outside"),
                example(MAIN, 'declare const dependencies: Type<unknown>[]\nconst all = [...dependencies]', "outside"),
                example(MAIN, `import { NestFactory } from "@nestjs/core"
declare module "@nestjs/core" { const NestFactory: { create(module: unknown): Promise<void> } }
@Module({}) class Core {}
NestFactory.create([Core])`, "outside"),
                example(OPTIONS, 'class Adapter {}\nexport const providers = [{ provide: "APPROVAL", useClass: Adapter }]', "outside"),
                example(GROUP, '@Module({}) class Core {}\nexport const area = () => [Core]', "group"),
                example(GROUP, '@Module({}) class Core {}\nexport const area = [Core]', "group"),
                example(GROUP, 'export const area: unknown[] = []', "group"),
                example(GROUP, 'export const area: Array<DynamicModule | string> = []', "group"),
                example(GROUP, 'export const area = (): object[] => []', "group"),
                example(GROUP, '@Module({}) class Core {}\nconst area = [Core]\nexport { area }', "group"),
                example(GROUP, '@Module({}) class Core {}\nexport default [Core]', "group"),
                example(GROUP, 'export const calculatePrice = (price: number): number => price * 2', "business"),
                example(GROUP, 'const calculatePrice = (price: number): number => price * 2', "business"),
                example(GROUP, `class Core {}\nexport const area = (enabled: boolean): Array<Type<unknown> | DynamicModule> => { if (enabled) return [Core]; return [] }`, "business"),
                example(GROUP, `class Core {}\nexport const area = (enabled: boolean): Array<Type<unknown> | DynamicModule> => enabled ? [Core] : []`, "business"),
            ],
        })
    })
}

for (const edition of ["lite", "full"]) {
    test(`R289 requires typed env delegation in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        const typed = ruleTester({ root: TYPED_ROOT, hfs })
        const envImport = 'import { EnvSource } from "@modules/platform/config"\n'
        const mainImport = envImport + 'import { readApiEnv } from "./api.env"\n'
        const read = 'const env = EnvSource.fromProcess()\nconst options = readApiEnv(env)'
        const envShape = 'export interface ApiEnv { readonly port: number }\nexport const readApiEnv = (env: EnvSource): ApiEnv => ({ port: env.int("PORT") })'
        typed.run("app-env-required", appEnvRequired, isolatedCases({
            valid: [
                { filename: ENV, code: envImport + envShape },
                { filename: ENV, code: envImport + 'export interface ApiEnv { readonly port: number }\nexport function readApiEnv(env: EnvSource): ApiEnv { return { port: env.int("PORT") } }' },
                { filename: MAIN, code: mainImport + read },
                { filename: MAIN, code: envImport + 'import { readApiEnv as read } from "./api.env"\nconst source = EnvSource.fromProcess()\nconst alias = source\nconst options = read(alias)' },
                { filename: MODULE, code: 'export const value = 1' },
            ],
            invalid: [
                { filename: ENV, code: envImport + 'export const readApiEnv = (env: EnvSource) => ({ port: env.int("PORT") })', errors: [{ messageId: "shape" }] },
                { filename: ENV, code: 'export interface ApiEnv { readonly port: number }\nexport const readApiEnv = (env: { port: number }): ApiEnv => env', errors: [{ messageId: "shape" }] },
                { filename: ENV, code: envImport + 'interface ApiEnv { readonly port: number }\nexport const readApiEnv = (env: EnvSource): ApiEnv => ({ port: env.int("PORT") })', errors: [{ messageId: "shape" }] },
                { filename: ENV, code: envImport + envShape.replaceAll("readApiEnv", "readOtherEnv"), errors: [{ messageId: "shape" }] },
                { filename: MAIN, code: mainImport + 'const env = EnvSource.fromProcess()\nconst port = env.int("PORT")', errors: [{ messageId: "inline" }] },
                { filename: MAIN, code: mainImport + read + '\nconst port = env["int"]("PORT")', errors: [{ messageId: "inline" }] },
                { filename: MAIN, code: mainImport + read + '\nconst reader = env.int\nconst port = reader("PORT")', errors: [{ messageId: "inline" }] },
                { filename: MAIN, code: mainImport + 'import { parsePlatformConfig } from "@modules/platform/config/platform.config"\nconst env = EnvSource.fromProcess()\nconst options = parsePlatformConfig(env)', errors: [{ messageId: "inline" }] },
                { filename: MAIN, code: mainImport + read + '\nconst again = EnvSource.fromProcess()', errors: [{ messageId: "inline" }] },
                { filename: MAIN, code: mainImport + read + '\nreadApiEnv(env)', errors: [{ messageId: "inline" }] },
                { filename: MAIN, code: mainImport + read + '\nconst port = process.env.PORT', errors: [{ messageId: "inline" }] },
                { filename: MAIN, code: envImport + 'const env = EnvSource.fromProcess()', errors: [{ messageId: "delegate" }] },
            ],
        }))
    })

    test(`R289 keeps root module entries in compose groups in ${edition}`, (t) => {
        const root = mkdtempSync(join(tmpdir(), "starci-compose-"))
        t.after(() => rmSync(root, { recursive: true, force: true }))
        const fixture = (file, code) => {
            const full = join(root, file)
            mkdirSync(join(full, ".."), { recursive: true })
            writeFileSync(full, code)
            return full
        }
        fixture("tsconfig.json", JSON.stringify({ compilerOptions: {
            target: "ES2022", module: "ESNext", moduleResolution: "Bundler", experimentalDecorators: true,
            paths: { "@nestjs/common": [join(TYPED_ROOT, "node_modules/@nestjs/common/index.d.ts")], "@nestjs/core": [join(TYPED_ROOT, "node_modules/@nestjs/core/index.d.ts")] },
        } }))
        fixture("apps/api/src/compose/platform.ts", `${contracts}\nclass Core {}\nexport const platformModules = (): Array<Type<unknown> | DynamicModule> => [Core]\nexport const entries: Array<Type<unknown> | DynamicModule> = [Core]`)
        const filename = join(root, "apps/api/src/app.module.ts")
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, root)
        const typed = ruleTester({ root, hfs })
        const imports = `${contracts}\nimport { platformModules as area, entries } from "./compose/platform"\nimport { APP_FILTER, APP_GUARD } from "@nestjs/core"\nclass Guard {}`
        typed.run("app-module-list-inline", appModuleListInline, isolatedCases({
            valid: [
                { filename, code: `${imports}\nexport const metadata = { imports: [...area(), ...entries], providers: [{ provide: APP_GUARD, useClass: Guard }, { provide: APP_FILTER, useClass: Guard }] }` },
                { filename, code: `${imports}\nexport const metadata = { imports: [], providers: [] }` },
                { filename, code: 'export const labels = ["api", "worker"]' },
            ],
            invalid: [
                { filename, code: `${imports}\n@Module({}) class Core {}\nexport const metadata = { imports: [Core] }`, errors: [{ messageId: "inline" }] },
                { filename, code: `${imports}\ndeclare const Core: { configure(): DynamicModule }\nexport const metadata = { imports: [...area(), Core.configure()] }`, errors: [{ messageId: "inline" }] },
                { filename, code: `${imports}\ndeclare const local: Array<DynamicModule | Type<unknown>>\nexport const metadata = { imports: [...local] }`, errors: [{ messageId: "inline" }] },
                { filename, code: `${imports}\nexport const metadata = { providers: [{ provide: "APP_GUARD", useClass: Guard }] }`, errors: [{ messageId: "inline" }] },
                { filename, code: `${contracts}\nconst APP_GUARD = "local"\nclass Guard {}\nexport const metadata = { providers: [{ provide: APP_GUARD, useClass: Guard }] }`, errors: [{ messageId: "inline" }] },
                { filename, code: `${imports}\n@Module({}) class Core {}\nconst modules = [Core]\nexport const metadata = { imports: [...modules] }`, errors: [{ messageId: "inline" }, { messageId: "inline" }] },
            ],
        }))
    })
}
