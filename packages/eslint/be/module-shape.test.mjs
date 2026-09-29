import test from "node:test"
import assert from "node:assert/strict"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
    globalModuleAllowlist,
    noModuleLet,
    noNewInjectable,
    oneModulePerFile,
    staticModuleRegister,
    typedModuleDefinition,
} from "./module-shape.mjs"
import { hfsParams, paramsFromManifest } from "./lib/slots.mjs"

const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const MODULE = "D:/repo/src/modules/domain/plan/plan.module.ts"

test("@Global is allowed only on the platform allowlist", () => {
    tester.run("global-module-allowlist", globalModuleAllowlist, {
        valid: [
            { filename: "D:/repo/src/modules/platform/config/config.module.ts", code: "@Global() @Module({}) class ConfigModule {}" },
            { filename: "D:/repo/src/modules/platform/logging/logging.module.ts", code: "@Global() @Module({}) class LoggingModule {}" },
            { filename: "D:/repo/src/modules/platform/database/database.module.ts", code: "@Global() @Module({}) class DatabaseModule {}" },
            { filename: MODULE, code: "@Module({}) class PlanModule {}" },
            { filename: "D:/repo/src/modules/domain/plan/plan.module.spec.ts", code: "@Global() @Module({}) class Probe {}" },
            { filename: MODULE, options: [{ allowed: ["domain/plan"] }], code: "@Module({}) class PlanModule {}" },
        ],
        invalid: [
            { filename: MODULE, code: "@Global() @Module({}) class PlanModule {}", errors: [{ messageId: "global" }] },
            { filename: "D:/repo/src/modules/platform/errors/errors.module.ts", code: "@Global() @Module({}) class ErrorsModule {}", errors: [{ messageId: "global" }] },
            { filename: "D:/repo/src/features/plan/plan.module.ts", code: "@Global @Module({}) class PlanModule {}", errors: [{ messageId: "global" }] },
            {
                filename: "D:/repo/src/modules/platform/config/config.module.ts",
                options: [{ allowed: ["platform/logging"] }],
                code: "@Global() @Module({}) class ConfigModule {}",
                errors: [{ messageId: "global" }],
            },
        ],
    })
})

test("the parameters come from the manifest ruleParams and nothing else", () => {
    const stated = paramsFromManifest({
        ruleParams: { be: { globalModules: ["src/modules/platform/config/"], fileLines: { soft: 400, hardGrowth: true } } },
        slots: [{ id: "be.feature", budget: { indexExports: 40 } }],
    })
    assert.deepEqual([...stated.globalModules], ["platform/config"])
    assert.deepEqual(stated.fileLines, { soft: 400, hardGrowth: 400 })
    assert.equal(stated.indexExports, 40)
    assert.throws(() => paramsFromManifest({ slots: [] }), /ruleParams.be.globalModules/)
    assert.ok(hfsParams.globalModules.length > 0)
})

test("a configurable module builder names its options type", () => {
    tester.run("typed-module-definition", typedModuleDefinition, {
        valid: [{ filename: MODULE, code: "const b = new ConfigurableModuleBuilder<PlanOptions>()" }],
        invalid: [{ filename: MODULE, code: "const b = new ConfigurableModuleBuilder()", errors: [{ messageId: "untyped" }] }],
    })
})

test("register and its siblings are static", () => {
    tester.run("static-module-register", staticModuleRegister, {
        valid: [
            { filename: MODULE, code: "@Module({}) class M { static register(o: O) { return {} } }" },
            { filename: MODULE, code: "class NotAModule { register() {} }" },
        ],
        invalid: [
            { filename: MODULE, code: "@Module({}) class M { register(o: O) { return {} } }", errors: [{ messageId: "notStatic" }] },
            { filename: MODULE, code: "@Module({}) class M { forRoot() { return {} } }", errors: [{ messageId: "notStatic" }] },
        ],
    })
})

test("a provider is built by the container, not by new", () => {
    tester.run("no-new-injectable", noNewInjectable, {
        valid: [
            { filename: MODULE, code: "const p = new Map()" },
            { filename: MODULE, code: "const e = new PlanNotFoundError({})" },
            { filename: MODULE, code: "const c = new AbortController()" },
            { filename: "D:/repo/src/modules/domain/plan/plan.service.spec.ts", code: "const s = new PlanService(repo)" },
        ],
        invalid: [
            { filename: MODULE, code: "const s = new PlanService(repo)", errors: [{ messageId: "construct" }] },
            { filename: MODULE, code: "const g = new AuthGuard()", errors: [{ messageId: "construct" }] },
        ],
    })
})

test("no mutable state at module scope", () => {
    tester.run("no-module-let", noModuleLet, {
        valid: [
            { filename: MODULE, code: "const x = 1; function f() { let y = 2; return y }" },
            { filename: "D:/repo/src/modules/domain/plan/plan.service.spec.ts", code: "let shared = 1" },
        ],
        invalid: [
            { filename: MODULE, code: "let counter = 0", errors: [{ messageId: "mutable" }] },
            { filename: MODULE, code: "export let cache = new Map()", errors: [{ messageId: "mutable" }] },
            { filename: MODULE, code: "var legacy = 1", errors: [{ messageId: "mutable" }] },
        ],
    })
})

test("a file declares one module", () => {
    tester.run("one-module-per-file", oneModulePerFile, {
        valid: [{ filename: MODULE, code: "@Module({}) class A {}\nclass B {}" }],
        invalid: [{ filename: MODULE, code: "@Module({}) class A {}\n@Module({}) class B {}", errors: [{ messageId: "many" }] }],
    })
})
