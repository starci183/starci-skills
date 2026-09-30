/**
 * Twin tests for the module-shape rules (R45).
 *
 *   node --test module-shape.test.mjs
 *
 * Type-aware cases use the fixture repository in `fixtures/typed`: `CatalogModule` and `OrderModule` are modules of
 * other owners, `CheckoutModule` the application module of the `checkout` feature.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import {
    isGlobalOnlyInApp,
    noCrossOwnerModuleImport,
    noGlobalDecorator,
    noModuleLet,
    noNewInjectable,
    oneModulePerFile,
    rules,
    staticModuleRegister,
    typedModuleDefinition,
} from "./module-shape.mjs"

const tester = typedTester()
const MODULE = at("src/modules/domain/plan/plan.module.ts")
const APP = at("apps/api/src/app.module.ts")

test("the retired global allowlist is gone", () => {
    assert.equal("global-module-allowlist" in rules, false)
})

test("@Global() is refused everywhere, specs included", () => {
    tester.run("no-global-decorator", noGlobalDecorator, {
        valid: [
            { filename: MODULE, code: "@Module({}) class PlanModule {}" },
            { filename: MODULE, code: "@Injectable() class PlanService {}" },
        ],
        invalid: [
            { filename: MODULE, code: "@Global() @Module({}) class PlanModule {}", errors: [{ messageId: "global" }] },
            { filename: at("src/modules/platform/config/config.module.ts"), code: "@Global() @Module({}) class ConfigModule {}", errors: [{ messageId: "global" }] },
            { filename: at("src/features/plan/plan.module.ts"), code: "@Global @Module({}) class PlanModule {}", errors: [{ messageId: "global" }] },
            { filename: at("src/modules/domain/plan/plan.module.spec.ts"), code: "@Global() @Module({}) class Probe {}", errors: [{ messageId: "global" }] },
            { filename: MODULE, code: 'import { Global as G } from "@nestjs/common"\n@G() class PlanModule {}', errors: [{ messageId: "global" }] },
            { filename: MODULE, code: 'import * as common from "@nestjs/common"\n@common.Global() class PlanModule {}', errors: [{ messageId: "global" }] },
        ],
    })
})

test("isGlobal: true is written only in apps/<app>/src/app.module.ts", () => {
    tester.run("is-global-only-in-app", isGlobalOnlyInApp, {
        valid: [
            { filename: APP, code: "const m = [CatalogModule.register({ isGlobal: true, ...options.catalog })]" },
            { filename: MODULE, code: "const b = builder.setExtras({ isGlobal: false }, (d, e) => ({ ...d, global: e.isGlobal }))" },
            { filename: MODULE, code: "const m = CatalogModule.register({ isGlobal: false })" },
            { filename: MODULE, code: "const flag = { isGlobal }" },
            { filename: MODULE, code: "const o = { global: true }" },
        ],
        invalid: [
            { filename: MODULE, code: "const m = CatalogModule.register({ isGlobal: true })", errors: [{ messageId: "isGlobal" }] },
            { filename: at("src/features/plan/plan.module.ts"), code: "@Module({ imports: [X.register({ isGlobal: true })] }) class M {}", errors: [{ messageId: "isGlobal" }] },
            { filename: at("apps/api/src/main.ts"), code: "const m = X.register({ isGlobal: true })", errors: [{ messageId: "isGlobal" }] },
            { filename: at("apps/api/src/api.composition.spec.ts"), code: "const m = X.register({ isGlobal: true })", errors: [{ messageId: "isGlobal" }] },
            { filename: at("src/modules/domain/plan/plan.module.spec.ts"), code: "const m = X.register({ isGlobal: true })", errors: [{ messageId: "isGlobal" }] },
            // a computed literal key and an assignment are the same write
            { filename: MODULE, code: "const m = { ['isGlobal']: true }", errors: [{ messageId: "isGlobal" }] },
            { filename: MODULE, code: "options.isGlobal = true", errors: [{ messageId: "isGlobal" }] },
            // a dynamic module literal with global: true is the same registration
            { filename: MODULE, code: "const d = { module: PlanModule, global: true }", errors: [{ messageId: "isGlobal" }] },
        ],
    })
})

const CROSS = at("src/modules/domain/plan/plan.module.ts")
const TRANSPORT = at("src/features/checkout/transport/graphql/checkout-graphql.module.ts")

test("a module never imports another owner's module", () => {
    tester.run("no-cross-owner-module-import", noCrossOwnerModuleImport, {
        valid: [
            // a transport module imports its own feature's application module: one owner
            { filename: TRANSPORT, code: 'import { CheckoutModule } from "../../application/checkout.module"\n@Module({ imports: [CheckoutModule] }) class CheckoutGraphqlModule {}' },
            // the app composes every owner
            { filename: APP, code: 'import { CatalogModule } from "@modules/domain/catalog"\nimport { OrderModule } from "@modules/domain/order"\n@Module({ imports: [CatalogModule.register({ isGlobal: true }), OrderModule] }) class AppModule {}' },
            // a module of a package is not another owner of this repository
            { filename: CROSS, code: 'import { SomePackageModule } from "some-package"\n@Module({ imports: [SomePackageModule] }) class PlanModule {}' },
            // no imports
            { filename: CROSS, code: "@Module({ providers: [] }) class PlanModule {}" },
            // an import that is not a module reference
            { filename: CROSS, code: "@Module({ imports: [...shared()] }) class PlanModule {}" },
        ],
        invalid: [
            { filename: CROSS, code: 'import { CatalogModule } from "@modules/domain/catalog"\n@Module({ imports: [CatalogModule] }) class PlanModule {}', errors: [{ messageId: "cross" }] },
            { filename: CROSS, code: 'import { CatalogModule } from "@modules/domain/catalog"\n@Module({ imports: [CatalogModule.register({ isGlobal: false })] }) class PlanModule {}', errors: [{ messageId: "cross" }] },
            // an alias is resolved to the class it names
            { filename: CROSS, code: 'import { OrderModule as Orders } from "@modules/domain/order"\n@Module({ imports: [Orders] }) class PlanModule {}', errors: [{ messageId: "cross" }] },
            { filename: TRANSPORT, code: 'import { OrderModule } from "@modules/domain/order"\n@Module({ imports: [OrderModule] }) class CheckoutGraphqlModule {}', errors: [{ messageId: "cross" }] },
            // another feature's application module
            { filename: TRANSPORT, code: 'import { OtherModule } from "../../../other/application/other.module"\n@Module({ imports: [OtherModule] }) class CheckoutGraphqlModule {}', errors: [{ messageId: "cross" }] },
            {
                filename: CROSS,
                code: 'import { CatalogModule } from "@modules/domain/catalog"\nimport { OrderModule } from "@modules/domain/order"\n@Module({ imports: [CatalogModule, OrderModule] }) class PlanModule {}',
                errors: [{ messageId: "cross" }, { messageId: "cross" }],
            },
        ],
    })
})

test("a configurable module builder names its options type", () => {
    tester.run("typed-module-definition", typedModuleDefinition, {
        valid: [{ filename: MODULE, code: "const b = new ConfigurableModuleBuilder<PlanOptions>()" }],
        invalid: [{ filename: MODULE, code: "const b = new ConfigurableModuleBuilder()", errors: [{ messageId: "untyped" }] }],
    })
})

test("register is the one factory and it is static", () => {
    tester.run("static-module-register", staticModuleRegister, {
        valid: [
            { filename: MODULE, code: "@Module({}) class M { static register(o: O) { return {} } }" },
            { filename: MODULE, code: "class NotAModule { register() {} forRoot() {} }" },
        ],
        invalid: [
            { filename: MODULE, code: "@Module({}) class M { register(o: O) { return {} } }", errors: [{ messageId: "notStatic" }] },
            { filename: MODULE, code: "@Module({}) class M { static forRoot() { return {} } }", errors: [{ messageId: "otherName" }] },
            { filename: MODULE, code: "@Module({}) class M { static forFeature() { return {} } }", errors: [{ messageId: "otherName" }] },
            { filename: MODULE, code: "@Module({}) class M { static registerAsync() { return {} } }", errors: [{ messageId: "otherName" }] },
            { filename: MODULE, code: "@Module({}) class M { forRootAsync() { return {} } }", errors: [{ messageId: "otherName" }] },
            { filename: MODULE, code: "@Module({}) class M { static forRoot = () => ({}) }", errors: [{ messageId: "otherName" }] },
        ],
    })
})

const ORDER = 'import { CommandHandler } from "@nestjs/cqrs"\nimport { OrderProvider, PlainGuard, ReportService } from "@modules/domain/order"\n'

test("a provider is built by the container, not by new", () => {
    tester.run("no-new-injectable", noNewInjectable, {
        valid: [
            { filename: MODULE, code: "const p = new Map()" },
            { filename: MODULE, code: "const c = new AbortController()" },
            // named like a provider, declared as a plain class: the declaration decides
            { filename: MODULE, code: `${ORDER}const r = new ReportService()\nconst g = new PlainGuard()` },
            // a spec constructs its subject with typed doubles
            { filename: at("src/modules/domain/plan/plan.service.spec.ts"), code: `${ORDER}const s = new OrderProvider()` },
            { filename: at("src/tests/e2e/plan/plan.e2e-spec.ts"), code: `${ORDER}const s = new OrderProvider()` },
        ],
        invalid: [
            { filename: MODULE, code: `${ORDER}const s = new OrderProvider()`, errors: [{ messageId: "construct" }] },
            // an alias is resolved to the class it names
            { filename: MODULE, code: 'import { OrderProvider as Svc } from "@modules/domain/order"\nconst s = new Svc()', errors: [{ messageId: "construct" }] },
            // a local provider declaration
            { filename: MODULE, code: '@Injectable()\nclass LocalThing {}\nconst t = new LocalThing()', errors: [{ messageId: "construct" }] },
            { filename: MODULE, code: '@CommandHandler(X)\nclass DoIt {}\nconst t = new DoIt()', errors: [{ messageId: "construct" }] },
            { filename: MODULE, code: '@Controller()\nclass Ctl {}\nconst t = new Ctl()', errors: [{ messageId: "construct" }] },
        ],
    })
})

test("no mutable state at module scope", () => {
    tester.run("no-module-let", noModuleLet, {
        valid: [{ filename: MODULE, code: "const x = 1; function f() { let y = 2; return y }" }],
        invalid: [
            { filename: MODULE, code: "let counter = 0", errors: [{ messageId: "mutable" }] },
            { filename: MODULE, code: "export let cache = new Map()", errors: [{ messageId: "mutable" }] },
            { filename: MODULE, code: "var legacy = 1", errors: [{ messageId: "mutable" }] },
            { filename: at("src/modules/domain/plan/plan.service.spec.ts"), code: "let shared = 1", errors: [{ messageId: "mutable" }] },
        ],
    })
})

test("a file declares one module", () => {
    tester.run("one-module-per-file", oneModulePerFile, {
        valid: [{ filename: MODULE, code: "@Module({}) class A {}\nclass B {}" }],
        invalid: [{ filename: MODULE, code: "@Module({}) class A {}\n@Module({}) class B {}", errors: [{ messageId: "many" }] }],
    })
})
