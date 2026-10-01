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
    capabilityModuleShape,
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
            // the test world is the test composition root: it registers capability modules like an app root
            { filename: at("src/tests/world/use-test-world.ts"), code: "const m = [CatalogModule.register({ isGlobal: true }), { module: PlanModule, global: true }]" },
            { filename: at("src/tests/world/contract.client.ts"), code: "const m = X.register({ isGlobal: true })" },
        ],
        invalid: [
            { filename: MODULE, code: "const m = CatalogModule.register({ isGlobal: true })", errors: [{ messageId: "isGlobal" }] },
            { filename: at("src/features/plan/plan.module.ts"), code: "@Module({ imports: [X.register({ isGlobal: true })] }) class M {}", errors: [{ messageId: "isGlobal" }] },
            { filename: at("apps/api/src/main.ts"), code: "const m = X.register({ isGlobal: true })", errors: [{ messageId: "isGlobal" }] },
            { filename: at("apps/api/src/api.options.ts"), code: "const m = X.register({ isGlobal: true })", errors: [{ messageId: "isGlobal" }] },
            { filename: at("src/modules/domain/plan/plan.module.spec.ts"), code: "const m = X.register({ isGlobal: true })", errors: [{ messageId: "isGlobal" }] },
            // a spec does not compose, and the same code in a feature or a domain file stays refused
            { filename: at("src/tests/integration/plan/plan.integration-spec.ts"), code: "const m = X.register({ isGlobal: true })", errors: [{ messageId: "isGlobal" }] },
            { filename: at("src/tests/e2e/flows/plan.e2e-spec.ts"), code: "const m = X.register({ isGlobal: true })", errors: [{ messageId: "isGlobal" }] },
            { filename: at("src/tests/fixtures/plan.builder.ts"), code: "const m = X.register({ isGlobal: true })", errors: [{ messageId: "isGlobal" }] },
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

const BASE = 'import { ConfigurableModuleClass, OPTIONS_TYPE } from "./plan.module-definition"\nimport type { DynamicModule } from "@nestjs/common"\n'
const DEFINITION = at("src/modules/domain/plan/plan.module-definition.ts")
const CHAIN = "export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<PlanOptions>().setExtras({ isGlobal: false }, (d, e) => ({ ...d, global: e.isGlobal })).build()"

test("a capability's representative module extends its module definition; sub-modules and feature modules are plain", () => {
    tester.run("capability-module-shape", capabilityModuleShape, {
        valid: [
            { filename: MODULE, code: `${BASE}@Module({}) export class PlanModule extends ConfigurableModuleClass {}` },
            // the one allowed override
            { filename: MODULE, code: `${BASE}@Module({}) export class PlanModule extends ConfigurableModuleClass { static register(options: typeof OPTIONS_TYPE): DynamicModule { return super.register(options) } }` },
            // a platform and an integrations capability follow the same shape
            { filename: at("src/modules/platform/cache/cache.module.ts"), code: 'import { ConfigurableModuleClass } from "./cache.module-definition"\n@Module({}) export class CacheModule extends ConfigurableModuleClass {}' },
            // a sub-module and a feature module are plain
            { filename: at("src/modules/domain/plan/plan-items.module.ts"), code: "@Module({ providers: [] }) export class PlanItemsModule {}" },
            { filename: at("src/features/checkout/application/checkout.module.ts"), code: "@Module({ providers: [] }) export class CheckoutModule {}" },
            { filename: at("src/features/checkout/transport/graphql/checkout-graphql.module.ts"), code: "@Module({ providers: [] }) export class CheckoutGraphqlModule {}" },
            // the app module composes: it has its own register(options: AppOptions)
            { filename: APP, code: "@Module({}) export class AppModule { static register(options: AppOptions) { return {} } }" },
            // the definition
            { filename: DEFINITION, code: CHAIN },
            { filename: at("src/modules/platform/cache/cache.module-definition.ts"), code: "export const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<CacheOptions>().setExtras({ isGlobal: false }, (d, e) => ({ ...d, global: e.isGlobal })).setClassMethodName('register').build()" },
        ],
        invalid: [
            { filename: MODULE, code: "@Module({}) export class PlanModule {}", errors: [{ messageId: "extendsBase" }] },
            { filename: MODULE, code: "@Module({}) export class PlanModule extends Other {}", errors: [{ messageId: "extendsBase" }] },
            // the base must come from this capability's own definition
            { filename: MODULE, code: 'import { ConfigurableModuleClass } from "./other.module-definition"\n@Module({}) export class PlanModule extends ConfigurableModuleClass {}', errors: [{ messageId: "extendsBase" }] },
            { filename: MODULE, code: 'import { ConfigurableModuleClass } from "@nestjs/common"\n@Module({}) export class PlanModule extends ConfigurableModuleClass {}', errors: [{ messageId: "extendsBase" }] },
            // an alias of a different export is not the base
            { filename: MODULE, code: 'import { OPTIONS_TYPE as ConfigurableModuleClass } from "./plan.module-definition"\n@Module({}) export class PlanModule extends ConfigurableModuleClass {}', errors: [{ messageId: "extendsBase" }] },
            // register overrides of any other shape
            { filename: MODULE, code: `${BASE}@Module({}) export class PlanModule extends ConfigurableModuleClass { static register(options: PlanOptions): DynamicModule { return super.register(options) } }`, errors: [{ messageId: "registerSignature" }] },
            { filename: MODULE, code: `${BASE}@Module({}) export class PlanModule extends ConfigurableModuleClass { static register(options: typeof OPTIONS_TYPE) { return super.register(options) } }`, errors: [{ messageId: "registerSignature" }] },
            { filename: MODULE, code: `${BASE}@Module({}) export class PlanModule extends ConfigurableModuleClass { register(options: typeof OPTIONS_TYPE): DynamicModule { return {} as never } }`, errors: [{ messageId: "registerSignature" }] },
            // sub-modules and feature modules are not configurable
            { filename: at("src/modules/domain/plan/plan-items.module.ts"), code: 'import { ConfigurableModuleClass } from "./plan.module-definition"\n@Module({}) export class PlanItemsModule extends ConfigurableModuleClass {}', errors: [{ messageId: "plain" }] },
            { filename: at("src/modules/domain/plan/plan-items.module.ts"), code: "@Module({}) export class PlanItemsModule { static register() { return {} } }", errors: [{ messageId: "plain" }] },
            { filename: at("src/features/checkout/application/checkout.module.ts"), code: "@Module({}) export class CheckoutModule extends Base {}", errors: [{ messageId: "plain" }] },
            { filename: at("src/features/checkout/checkout.module.ts"), code: "@Module({}) export class CheckoutModule { static register() { return {} } }", errors: [{ messageId: "plain" }] },
            // a feature has no module definition
            { filename: at("src/features/checkout/checkout.module-definition.ts"), code: CHAIN, errors: [{ messageId: "featureDefinition" }] },
            // the definition chain
            { filename: DEFINITION, code: "export const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<PlanOptions>().build()", errors: [{ messageId: "chain" }] },
            { filename: DEFINITION, code: "export const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<PlanOptions>().setExtras({ isGlobal: true }, (d, e) => d).build()", errors: [{ messageId: "chain" }] },
            { filename: DEFINITION, code: "export const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<PlanOptions>().setExtras({ isGlobal }, (d, e) => d).build()", errors: [{ messageId: "chain" }] },
            { filename: DEFINITION, code: "export const builder = new ConfigurableModuleBuilder<PlanOptions>().setExtras({ isGlobal: false }, (d, e) => d)", errors: [{ messageId: "chain" }] },
            { filename: DEFINITION, code: "export const x = 1", errors: [{ messageId: "chain" }] },
        ],
    })
})
