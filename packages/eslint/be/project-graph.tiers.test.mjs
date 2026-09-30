import test from "node:test"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

/** The cases of one repository: `rels` are clean files, `lines` maps a violating file to the lines the machine names. */
const ok = (f, files, rels) => rels.map((rel) => ({ filename: f.at(rel), code: files[rel] }))
const bad = (f, files, lines) => Object.entries(lines).map(([rel, at]) => ({
    filename: f.at(rel),
    code: files[rel],
    errors: at.map((line) => ({ messageId: "finding", line })),
}))

const nestTypes = {
    "node_modules/@nestjs/common/package.json": '{"name":"@nestjs/common","types":"index.d.ts"}',
    "node_modules/@nestjs/common/index.d.ts": "export declare const Body:(...args:any[])=>any; export declare const Injectable:(...args:any[])=>any; export declare function Module(metadata: Record<string, unknown>): ClassDecorator;\n",
    "node_modules/@nestjs/graphql/package.json": '{"name":"@nestjs/graphql","types":"index.d.ts"}',
    "node_modules/@nestjs/graphql/index.d.ts": "export declare const Args:(...args:any[])=>any; export declare const ArgsType:(...args:any[])=>any; export declare const InputType:(...args:any[])=>any; export declare const Mutation:(...args:any[])=>any; export declare const ObjectType:(...args:any[])=>any; export declare const Query:(...args:any[])=>any; export declare const Resolver:(...args:any[])=>any;\n",
    "node_modules/typeorm/package.json": '{"name":"typeorm","types":"index.d.ts"}',
    "node_modules/typeorm/index.d.ts": "export declare const Entity:(...args:any[])=>any; export declare const ViewEntity:(...args:any[])=>any; export declare class EntitySchema<T=unknown>{constructor(options:unknown)}\n",
}

test("an import goes only to a tier the slot matrix allows", () => {
    const files = {
        "apps/core/src/app.module.ts": "import { a } from '../../../src/features/a';\nexport const AppModule = [a];\n",
        "src/features/a/index.ts": "import { x } from '../../modules/domain/x';\nimport { p } from '../../modules/platform/config';\nimport { i } from '../../modules/integrations/mail';\nimport { inner } from './application/inner';\nexport const a = [x, p, i, inner];\n",
        "src/features/a/application/inner.ts": "export const inner = 1;\n",
        "src/features/c/index.ts": "import { b } from '../b';\nexport const c = b;\n",
        "src/features/b/index.ts": "export const b = 1;\n",
        "src/modules/domain/x/index.ts": "import { a } from '../../../features/a';\nexport const x = a;\n",
        "src/modules/platform/config/index.ts": "import { x } from '../../domain/x';\nexport const p = x;\n",
        "src/modules/integrations/mail/index.ts": "import { p } from '../../platform/config';\nimport { x } from '../../domain/x';\nexport const i = [p, x];\n",
        "src/features/orders/contract.ts": "export type FeatureContract = string\n",
        "src/features/orders/load.ts": "export const feature = 1\n",
        "src/modules/platform/shared/barrel.ts": 'export type { FeatureContract } from "../../../features/orders/contract"\n',
        "src/modules/domain/catalog/load.ts": 'export const load = () => import("../../../features/orders/load", { with: { type: "json" } })\n',
        "src/modules/domain/catalog/import-type.ts": 'export type Hidden = import("../../../features/orders/contract").FeatureContract\n',
        "src/features/http/app-link.ts": 'export * from "../../../apps/core/src/app.module"\n',
    }
    const f = projectFixture({ files })
    f.tester.run("tier-direction", rules["tier-direction"], {
        valid: [...ok(f, files, [
            "apps/core/src/app.module.ts",
            "src/features/a/index.ts",
            "src/features/a/application/inner.ts",
            "src/features/c/index.ts",
            "src/features/b/index.ts",
        ])],
        invalid: [...bad(f, files, {
            "src/modules/domain/x/index.ts": [1],
            "src/modules/platform/config/index.ts": [1],
            "src/modules/integrations/mail/index.ts": [2],
            "src/modules/platform/shared/barrel.ts": [1],
            "src/modules/domain/catalog/load.ts": [1],
            "src/modules/domain/catalog/import-type.ts": [1],
            "src/features/http/app-link.ts": [1],
        })],
    })
    f.cleanup()
})

test("owners never import each other in a cycle", () => {
    const files = {
        "src/modules/domain/x/index.ts": "import { y } from '../y';\nexport const x = y;\n",
        "src/modules/domain/y/index.ts": "import type { X } from '../x';\nexport const y = 1;\nexport type Y = X;\n",
        "src/modules/domain/a/index.ts": "import { b } from '../b';\nexport const a = b;\n",
        "src/modules/domain/b/index.ts": "import { c } from '../c';\nexport const b = c;\n",
        "src/modules/domain/c/index.ts": "import { a } from '../a';\nexport const c = a;\n",
        "src/modules/domain/p/index.ts": "import { q } from '../q';\nexport const p = q;\n",
        "src/modules/domain/q/index.ts": "import { r } from '../r';\nexport const q = r;\n",
        "src/modules/domain/r/index.ts": "export const r = 1;\n",
    }
    const f = projectFixture({ files })
    f.tester.run("owner-cycle", rules["owner-cycle"], {
        valid: [...ok(f, files, ["src/modules/domain/p/index.ts", "src/modules/domain/q/index.ts", "src/modules/domain/r/index.ts"])],
        invalid: [...bad(f, files, {
            "src/modules/domain/x/index.ts": [1],
            "src/modules/domain/a/index.ts": [1],
        })],
    })
    f.cleanup()
})

test("a feature never imports another feature, type-only imports included", () => {
    const files = {
        "src/features/a/index.ts": "import { b } from '../b';\nexport const a = b + 1;\n",
        "src/features/b/index.ts": "export const b = 1;\n",
        "src/features/c/index.ts": "import type { D } from '../d';\nexport type C = D;\n",
        "src/features/d/index.ts": "export type D = string;\n",
        "src/features/e/index.ts": "import { x } from '../../modules/domain/x';\nimport { p } from '../../modules/platform/config';\nimport { i } from '../../modules/integrations/mail';\nimport { inner } from './application/inner';\nexport const e = [x, p, i, inner];\n",
        "src/features/e/application/inner.ts": "export const inner = 1;\n",
        "src/modules/domain/x/index.ts": "export const x = 1;\n",
        "src/modules/platform/config/index.ts": "export const p = 1;\n",
        "src/modules/integrations/mail/index.ts": "export const i = 1;\n",
    }
    const f = projectFixture({ files })
    f.tester.run("feature-imports-feature", rules["feature-imports-feature"], {
        valid: [...ok(f, files, [
            "src/features/b/index.ts",
            "src/features/d/index.ts",
            "src/features/e/index.ts",
            "src/features/e/application/inner.ts",
            "src/modules/domain/x/index.ts",
        ])],
        invalid: [...bad(f, files, {
            "src/features/a/index.ts": [1],
            "src/features/c/index.ts": [1],
        })],
    })
    f.cleanup()
})

test("a feature file sits in the folder its role names", () => {
    const files = {
        ...nestTypes,
        "src/features/orders/index.ts": 'export { CreateOrderHandler } from "./application/create-order.handler";\n',
        "src/features/orders/orders.module.ts": "export class OrdersModule {}\n",
        "src/features/orders/application/create-order.contracts.ts": "export interface CreateOrderParams { readonly itemId:string } export interface CreateOrderResult { readonly id:string }\n",
        "src/features/orders/application/create-order.handler.ts": 'import type { CreateOrderParams,CreateOrderResult } from "./create-order.contracts"; export class CreateOrderHandler { execute(input:CreateOrderParams):CreateOrderResult{return {id:input.itemId}} }\n',
        "src/features/orders/transport/graphql/dto/create-order.request.ts": 'import { InputType } from "@nestjs/graphql"; @InputType() export class CreateOrderRequest { itemId!:string }\n',
        "src/features/orders/transport/graphql/create-order.resolver.ts": 'import { Args,Mutation } from "@nestjs/graphql"; import { CreateOrderRequest } from "./dto/create-order.request"; export class CreateOrderResolver { @Mutation(()=>String,{name:"createOrder"}) create(@Args("input") request:CreateOrderRequest){return request.itemId} }\n',
        "src/modules/platform/database/entities/order.entity.ts": 'import { Entity } from "typeorm"; @Entity() export class OrderEntity {}\n',
        "src/features/billing/application/create-invoice.request.ts": "export class CreateInvoiceRequest {}\n",
        "src/features/billing/transport/graphql/dto/invoice.entity.ts": 'import { Entity } from "typeorm"; @Entity() export class InvoiceEntity {}\n',
        "src/features/billing/migrations/1790000000000-CreateInvoices.ts": "export class CreateInvoices { up(){} down(){} }\n",
        "src/features/billing/transport/graphql/invoice-view.mapper.ts": 'import { ViewEntity } from "typeorm"; @ViewEntity() export class InvoiceViewMapper {}\n',
        "src/features/billing/application/invoice-schema.handler.ts": 'import { EntitySchema } from "typeorm"; const make=()=>new EntitySchema({name:"invoice"}); export const schema=make();\n',
    }
    const f = projectFixture({ files })
    f.tester.run("feature-layout", rules["feature-layout"], {
        valid: [...ok(f, files, [
            "src/features/orders/index.ts",
            "src/features/orders/orders.module.ts",
            "src/features/orders/application/create-order.contracts.ts",
            "src/features/orders/application/create-order.handler.ts",
            "src/features/orders/transport/graphql/dto/create-order.request.ts",
            "src/features/orders/transport/graphql/create-order.resolver.ts",
            "src/modules/platform/database/entities/order.entity.ts",
        ])],
        invalid: [...bad(f, files, {
            "src/features/billing/application/create-invoice.request.ts": [1, 1],
            "src/features/billing/transport/graphql/dto/invoice.entity.ts": [1, 1],
            "src/features/billing/migrations/1790000000000-CreateInvoices.ts": [1],
            "src/features/billing/transport/graphql/invoice-view.mapper.ts": [1],
            "src/features/billing/application/invoice-schema.handler.ts": [1, 1],
        })],
    })
    f.cleanup()
})

test("application code never imports transport code, directly or through a chain", () => {
    const files = {
        ...nestTypes,
        "src/modules/domain/orders/service.ts": "export class OrdersService { create(input: {name:string}) { return input } }\n",
        "src/features/orders/application/valid.use-case.ts": 'import * as Nest from "@nestjs/common"; import { OrdersService } from "../../../modules/domain/orders/service"; interface ValidParams {name:string} interface ValidResult {name:string} @Nest.Injectable() export class ValidUseCase { constructor(private readonly orders: OrdersService) {} execute(input:ValidParams):ValidResult { return this.orders.create(input) } }\n',
        "src/features/orders/application/valid-cjs.use-case.ts": 'import Nest = require("@nestjs/common"); @Nest.Injectable() export class ValidCjsUseCase {}\n',
        "src/features/orders/application/valid-shadow-es.use-case.ts": 'import * as Nest from "@nestjs/common"; @Nest.Injectable() export class ValidShadowEsUseCase { execute(value:unknown):unknown { function normalize(Nest:{Body:unknown}) { return Nest.Body }; return normalize({Body:value}) } }\n',
        "src/features/orders/shared/capability.ts": "export const execute = (value: unknown) => value\n",
        "src/features/orders/application/valid-shared.use-case.ts": 'import { execute } from "../shared/capability"; export class ValidSharedUseCase { execute(value:unknown){ return execute(value) } }\n',
        "src/features/orders/transport/graphql/create.input.ts": "export class CreateInput { name!: string }\n",
        "src/features/orders/transport/index.ts": 'export type { CreateInput } from "./graphql/create.input"\n',
        "src/features/orders/shared/transport-types.ts": 'export type { CreateInput } from "../transport"\n',
        "src/features/orders/application/invalid.use-case.ts": 'import * as Nest from "@nestjs/common"; import { ArgsType } from "@nestjs/graphql"; import type { CreateInput } from "../shared/transport-types"; @ArgsType() export class InvalidUseCase { execute(@Nest.Body() input:CreateInput){ return input } }\n',
        "src/features/orders/application/invalid-cjs.use-case.ts": 'import Nest = require("@nestjs/common"); export class InvalidCjsUseCase { execute(@Nest.Body() input:unknown){ return input } }\n',
        "src/features/orders/application/invalid-destructured.use-case.ts": 'import * as Nest from "@nestjs/common"; const { Body } = Nest; export class InvalidDestructuredUseCase { execute(@Body() input:unknown){ return input } }\n',
        "src/features/orders/shared/protocol.ts": 'export { Body } from "@nestjs/common"; export { ArgsType as Input } from "@nestjs/graphql"\n',
        "src/features/orders/application/invalid-protocol.use-case.ts": 'import { Body, Input } from "../shared/protocol"; @Input() export class InvalidProtocolUseCase { execute(@Body() input:unknown){ return input } }\n',
    }
    const f = projectFixture({ files })
    f.tester.run("application-never-imports-transport", rules["application-never-imports-transport"], {
        valid: [...ok(f, files, [
            "src/features/orders/application/valid.use-case.ts",
            "src/features/orders/application/valid-cjs.use-case.ts",
            "src/features/orders/application/valid-shadow-es.use-case.ts",
            "src/features/orders/application/valid-shared.use-case.ts",
            "src/features/orders/transport/graphql/create.input.ts",
        ])],
        invalid: [...bad(f, files, {
            "src/features/orders/application/invalid.use-case.ts": [1, 1, 1],
            "src/features/orders/application/invalid-cjs.use-case.ts": [1],
            "src/features/orders/application/invalid-destructured.use-case.ts": [1],
            "src/features/orders/application/invalid-protocol.use-case.ts": [1],
        })],
    })
    f.cleanup()
})

test("another owner is imported only through its index entry, and an entry never uses export star", () => {
    const files = {
        "src/features/orders/index.ts": 'export * from "./public"\n',
        "src/features/orders/public.ts": "export const publicOrder = 1\n",
        "src/features/orders/private.ts": "export const secretOrder = 2\n",
        "src/features/orders/internal.ts": 'import { secretOrder } from "./private"; export const internal = secretOrder\n',
        "src/features/catalog/valid.ts": 'import { publicOrder } from "../orders"; export const valid = publicOrder\n',
        "src/features/catalog/invalid.ts": 'import { secretOrder } from "../orders/private"; export const invalid = secretOrder\n',
        "src/modules/platform/orders/barrel.ts": 'export { secretOrder } from "../../../features/orders/private"\n',
        "src/features/catalog/indirect.ts": 'import { secretOrder } from "../../modules/platform/orders/barrel"; export const indirect = secretOrder\n',
        "src/modules/domain/x/index.ts": "export const x = 1;\n",
        "src/modules/domain/x/persistence/entities/x.entity.ts": "export class XEntity {}\n",
        "src/tests/fixtures/builders/x.builder.ts": "import { XEntity } from '../../../modules/domain/x/persistence/entities/x.entity';\nexport const rows = [XEntity];\n",
        "src/tests/fixtures/other.contracts.ts": "import { XEntity } from '../../modules/domain/x/persistence/entities/x.entity';\nexport const rows = [XEntity];\n",
        "src/features/a/index.ts": "import { XEntity } from '../../modules/domain/x/persistence/entities/x.entity';\nexport const a = XEntity;\n",
    }
    const f = projectFixture({ files })
    f.tester.run("owner-export-bypass", rules["owner-export-bypass"], {
        valid: [...ok(f, files, [
            "src/features/orders/public.ts",
            "src/features/orders/internal.ts",
            "src/features/catalog/valid.ts",
            "src/modules/domain/x/index.ts",
            "src/tests/fixtures/builders/x.builder.ts",
        ])],
        invalid: [...bad(f, files, {
            "src/features/orders/index.ts": [1],
            "src/features/catalog/invalid.ts": [1],
            "src/features/catalog/indirect.ts": [1],
            "src/tests/fixtures/other.contracts.ts": [1],
            "src/features/a/index.ts": [1],
        })],
    })
    f.cleanup()
})

test("every feature owner is composed into an app by a runtime import", () => {
    const files = {
        "apps/core/src/app.module.ts": "import { FooModule } from '../../../src/features/foo';\nimport type { BarModule } from '../../../src/features/bar';\nexport const AppModule: [typeof FooModule, BarModule | null] = [FooModule, null];\n",
        "src/features/foo/index.ts": "export { FooModule } from './foo.module';\n",
        "src/features/foo/foo.module.ts": "import { BillingModule } from '../../modules/domain/billing';\nexport class FooModule { static imports = [BillingModule]; }\n",
        "src/features/bar/index.ts": "export { BarModule } from './bar.module';\n",
        "src/features/bar/bar.module.ts": "export class BarModule {}\n",
        "src/features/orphan/index.ts": "export { OrphanModule } from './orphan.module';\n",
        "src/features/orphan/orphan.module.ts": "export class OrphanModule {}\n",
        "src/modules/domain/billing/index.ts": "export { BillingModule } from './billing.module';\n",
        "src/modules/domain/billing/billing.module.ts": "import { mail } from '../../integrations/mail';\nexport class BillingModule { static mail = mail; }\n",
        "src/modules/integrations/mail/index.ts": "export const mail = 1;\n",
        "src/modules/integrations/unused/index.ts": "export const unused = 1;\n",
    }
    const f = projectFixture({ files })
    f.tester.run("feature-not-composed", rules["feature-not-composed"], {
        valid: [...ok(f, files, [
            "apps/core/src/app.module.ts",
            "src/features/foo/index.ts",
            "src/modules/domain/billing/index.ts",
            "src/modules/integrations/mail/index.ts",
        ])],
        invalid: [...bad(f, files, {
            "src/features/bar/index.ts": [1],
            "src/features/orphan/index.ts": [1],
            "src/modules/integrations/unused/index.ts": [1],
        })],
    })
    f.cleanup()
})

const tsconfig = (paths, include = ["src/**/*", "apps/**/*", "packages/**/*"]) => JSON.stringify({
    compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", baseUrl: ".", paths, noEmit: true, experimentalDecorators: true },
    include,
})

test("a package never imports an app", () => {
    const files = {
        "package.json": JSON.stringify({ private: true, workspaces: ["apps/*", "packages/*"] }),
        "tsconfig.json": tsconfig({ "@fixture/api/*": ["apps/api/src/*"], "@fixture/ui": ["packages/ui/src/index.ts"], "@fixture/ui/*": ["packages/ui/src/*"] }),
        "apps/api/package.json": JSON.stringify({ name: "@fixture/api", private: true }),
        "apps/api/src/main.ts": "import { Public } from '@fixture/ui/public';\nvoid Public;\n",
        "apps/api/src/app.module.ts": "export class AppModule {}\n",
        "apps/api/src/contract.ts": "export type AppContract = string\n",
        "packages/ui/package.json": JSON.stringify({ name: "@fixture/ui", private: true, exports: { ".": "./src/index.ts", "./public": "./src/public/index.ts" } }),
        "packages/ui/src/index.ts": "export type { AppContract } from '@fixture/api/contract'\nexport const ui = 1\n",
        "packages/ui/src/public/index.ts": "export const Public = 1\n",
        "packages/ui/src/clean.ts": "export const clean = 1\n",
    }
    const f = projectFixture({ files, apps: [{ name: "api", kind: "api" }] })
    f.tester.run("package-imports-app", rules["package-imports-app"], {
        valid: [...ok(f, files, [
            "apps/api/src/main.ts",
            "apps/api/src/contract.ts",
            "packages/ui/src/public/index.ts",
            "packages/ui/src/clean.ts",
        ])],
        invalid: [...bad(f, files, { "packages/ui/src/index.ts": [1] })],
    })
    f.cleanup()
})

test("a package is imported only through its declared exports", () => {
    const files = {
        "package.json": JSON.stringify({ private: true, workspaces: ["apps/*", "packages/*"] }),
        "tsconfig.json": tsconfig({ "@fixture/ui": ["packages/ui/src/index.ts"], "@fixture/ui/*": ["packages/ui/src/*"] }),
        "apps/api/package.json": JSON.stringify({ name: "@fixture/api", private: true }),
        "apps/api/src/main.ts": "import { Public } from '@fixture/ui/public';\nimport { Private } from '@fixture/ui/private';\nvoid [Public, Private];\n",
        "apps/api/src/app.module.ts": "import { Public } from '@fixture/ui/public';\nimport { ui } from '@fixture/ui';\nexport class AppModule { static uses = [Public, ui] }\n",
        "packages/ui/package.json": JSON.stringify({ name: "@fixture/ui", private: true, exports: { ".": "./src/index.ts", "./public": "./src/public/index.ts" } }),
        "packages/ui/src/index.ts": "export const ui = 1\n",
        "packages/ui/src/public/index.ts": "export const Public = 1\n",
        "packages/ui/src/private/index.ts": "export const Private = 1\n",
    }
    const f = projectFixture({ files, apps: [{ name: "api", kind: "api" }] })
    f.tester.run("package-export-bypass", rules["package-export-bypass"], {
        valid: [...ok(f, files, [
            "apps/api/src/app.module.ts",
            "packages/ui/src/index.ts",
            "packages/ui/src/public/index.ts",
            "packages/ui/src/private/index.ts",
        ])],
        invalid: [...bad(f, files, { "apps/api/src/main.ts": [2] })],
    })
    f.cleanup()
})

test("every owner export and every production file is reached by a root", () => {
    const files = {
        "tsconfig.json": tsconfig({}),
        "apps/core/src/app.module.ts": "import { a } from '../../../src/features/a';\nimport { b } from '../../../src/features/b';\nexport const AppModule = [a, b];\nexport const extra = 2;\n",
        "apps/core/src/main.ts": "import { boot } from './boot';\nboot();\n",
        "apps/core/src/boot.ts": "export const boot = () => 1;\n",
        "apps/core/src/stray.ts": "export const stray = 1;\n",
        "src/features/a/index.ts": [
            "import { used } from '../../modules/domain/x';",
            "import * as ns from '../../modules/domain/ns';",
            "import { renamed as r } from '../../modules/domain/alias';",
            "import type { Shape } from '../../modules/domain/shape';",
            "import { named } from '../../modules/domain/def';",
            "import { helper } from '../../modules/domain/ry';",
            "import { keep } from '../../modules/domain/sp';",
            "import { usedCons } from '../../modules/domain/cons';",
            "export const a = [used, ns, r, named, helper, keep, usedCons, (): Shape => ({ a: 1 }), () => import('../../modules/domain/dyn')];",
            "",
        ].join("\n"),
        "src/features/a/a.spec.ts": "import { onlySpec } from '../../modules/domain/sp';\nvoid onlySpec;\n",
        "src/features/a/a.service.spec.ts": "import { TOKEN } from '../../modules/domain/cons';\nit('uses', () => { expect(TOKEN).toBe(1); });\n",
        "src/modules/domain/x/index.ts": "export const used = 1;\nexport const unused = 2;\nexport function alsoUnused() { return 3; }\n",
        "src/modules/domain/ns/index.ts": "export const one = 1;\nexport const two = 2;\n",
        "src/modules/domain/dyn/index.ts": "export const one = 1;\nexport const two = 2;\n",
        "src/modules/domain/alias/index.ts": "import { inner } from './inner';\nexport { inner as renamed };\nexport const local = 1;\n",
        "src/modules/domain/alias/inner.ts": "import { local } from './index';\nexport const inner = local;\n",
        "src/modules/domain/shape/index.ts": "export type Shape = { a: number };\nexport type Other = string;\n",
        "src/modules/domain/def/index.ts": "export default 1;\nexport const named = 2;\n",
        "src/modules/domain/rx/index.ts": "export const helper = 1;\nexport const other = 2;\n",
        "src/modules/domain/ry/index.ts": "export { helper } from '../rx';\nexport { other } from '../rx';\n",
        "src/modules/domain/sp/index.ts": "export const keep = 1;\nexport const onlySpec = 2;\n",
        "src/modules/domain/cons/index.ts": "export const TOKEN = 1;\nexport type Params = { a: number };\nexport const nobody = 2;\nexport const onlyE2e = 3;\nexport const usedCons = 4;\n",
        "src/tests/fixtures/builders/cons.builder.ts": "import type { Params } from '../../../modules/domain/cons';\nexport const build = (): Params => ({ a: 1 });\n",
        "src/tests/e2e/cons/cons.e2e-spec.ts": "import { onlyE2e } from '../../../modules/domain/cons';\nit('uses', () => { expect(onlyE2e).toBe(3); });\n",
        "src/modules/domain/used/index.ts": "export { used } from './used';\n",
        "src/modules/domain/used/used.ts": "import type { Shape } from './shape';\nexport const used: Shape = 1;\n",
        "src/modules/domain/used/shape.ts": "export type Shape = number;\n",
        "src/modules/domain/used/orphan.ts": "export const orphan = 1;\n",
        "src/modules/domain/used/spec-only.ts": "export const specOnly = 1;\n",
        "src/modules/domain/used/spec-only.spec.ts": "import { specOnly } from './spec-only';\nvoid specOnly;\n",
        "src/features/b/index.ts": "import { used } from '../../modules/domain/used';\nexport const b = used;\n",
        "packages/shared/package.json": JSON.stringify({ name: "@fixture/shared", private: true }),
        "packages/shared/src/index.ts": "export { shared } from './shared';\n",
        "packages/shared/src/shared.ts": "export const shared = 1;\n",
        "packages/shared/src/orphan.ts": "export const orphan = 1;\n",
    }
    const f = projectFixture({ files })
    f.tester.run("dead-exports", rules["dead-exports"], {
        valid: [...ok(f, files, [
            "apps/core/src/app.module.ts",
            "apps/core/src/main.ts",
            "apps/core/src/boot.ts",
            "src/features/a/index.ts",
            "src/modules/domain/ns/index.ts",
            "src/modules/domain/dyn/index.ts",
            "src/modules/domain/alias/inner.ts",
            "src/modules/domain/used/used.ts",
            "src/modules/domain/used/shape.ts",
            "packages/shared/src/shared.ts",
        ])],
        invalid: [...bad(f, files, {
            "apps/core/src/stray.ts": [1],
            "src/modules/domain/x/index.ts": [2, 3],
            "src/modules/domain/alias/index.ts": [3],
            "src/modules/domain/shape/index.ts": [2],
            "src/modules/domain/def/index.ts": [1],
            "src/modules/domain/rx/index.ts": [2],
            "src/modules/domain/ry/index.ts": [2],
            "src/modules/domain/sp/index.ts": [2],
            "src/modules/domain/cons/index.ts": [3, 4],
            "src/modules/domain/used/orphan.ts": [1],
            "src/modules/domain/used/spec-only.ts": [1],
            "packages/shared/src/index.ts": [1],
            "packages/shared/src/orphan.ts": [1],
        })],
    })
    f.cleanup()
})

/** A function of `statements + 4` lines whose shape never repeats inside one body; a copy with other names and literals is a clone. */
const helper = (name, statements, { literal = 1, variable = "value", offset = 0 } = {}) => {
    const chain = (i) => ` + ${literal}`.repeat(i % 7)
    const patterns = [
        (i) => `  const ${variable}${i} = input.items[${i}] ?? ${literal}${chain(i)};`,
        (i) => `  if (${variable}${i - 1} > ${literal + i}${chain(i)}) total += ${variable}${i - 1};`,
        (i) => `  total = total * ${literal + 2} + ${i}${chain(i)};`,
        (i) => `  for (const entry of input.items) { total += entry * ${literal + i}${chain(i)}; }`,
        (i) => `  while (total > ${literal + i}${chain(i)}) total -= ${i};`,
        (i) => `  total = Math.max(total, input.items.length + ${literal + i}${chain(i)});`,
        (i) => `  input.items.push(total % ${literal + i + 1}${chain(i)});`,
        (i) => `  total += input.items.reduce((sum, item) => sum + item * ${literal + i}${chain(i)}, 0);`,
        (i) => `  if (!input.items.length) return ${literal + i}${chain(i)};`,
        (i) => `  total = input.items.map((item) => item + ${literal + i}${chain(i)}).length;`,
        (i) => `  try { total += JSON.parse(String(${i}${chain(i)})); } catch { total = ${literal}; }`,
    ]
    const body = Array.from({ length: statements }, (_, i) => patterns[(i + offset) % patterns.length](i))
    return `export function ${name}(input: { items: number[] }) {\n  let total = 0;\n${body.join("\n")}\n  return total;\n}\n`
}

test("a block of production code never repeats elsewhere in the owner graph", () => {
    const files = {
        "src/modules/domain/alpha/alpha.service.ts": `import { z } from 'zod';\n\n${helper("compute", 26)}`,
        "src/modules/domain/beta/beta.service.ts": `import { z } from 'zod';\n\n${helper("calculate", 26, { literal: 9, variable: "item" })}`,
        "src/modules/domain/gamma/gamma.service.ts": `export function shape(input: string[]) {\n${Array.from({ length: 30 }, (_, i) => `  for (const entry of input) { if (entry.length > ${i}) { console.log(entry); } }`).join("\n")}\n}\n`,
        "src/modules/domain/delta/delta.service.ts": `import { z } from 'zod';\n\n${helper("small", 3, { literal: 4, offset: 5 })}`,
        "src/modules/domain/epsilon/epsilon.service.ts": helper("tiny", 3, { literal: 4, variable: "item", offset: 5 }),
        "src/modules/domain/one/one.service.ts": `import { z } from 'zod';\n\n${helper("same", 26, { literal: 6, offset: 2 })}`,
        "src/modules/domain/one/one.contracts.ts": helper("again", 26, { literal: 6, variable: "item", offset: 2 }),
    }
    const f = projectFixture({ files })
    f.tester.run("duplicate-code", rules["duplicate-code"], {
        valid: [...ok(f, files, [
            "src/modules/domain/beta/beta.service.ts",
            "src/modules/domain/gamma/gamma.service.ts",
            "src/modules/domain/delta/delta.service.ts",
            "src/modules/domain/epsilon/epsilon.service.ts",
            "src/modules/domain/one/one.service.ts",
        ])],
        invalid: [...bad(f, files, {
            "src/modules/domain/alpha/alpha.service.ts": [3],
            "src/modules/domain/one/one.contracts.ts": [1],
        })],
    })
    f.cleanup()
})

test("uniform entry files are not compared, the same bodies in other files are a clone", () => {
    const apps = [{ name: "core", kind: "api" }, { name: "other", kind: "api" }]
    const files = {
        "apps/core/src/main.ts": helper("boot", 26),
        "apps/other/src/main.ts": helper("start", 26, { variable: "item" }),
        "src/features/a/transport/graphql/a.resolver.ts": helper("resolveA", 26),
        "src/features/b/transport/graphql/b.resolver.ts": helper("resolveB", 26, { variable: "item" }),
        "apps/core/src/app.module.ts": helper("composeCore", 26, { literal: 5 }),
        "apps/other/src/app.module.ts": helper("composeOther", 26, { literal: 5, variable: "item" }),
    }
    const f = projectFixture({ files, apps })
    f.tester.run("duplicate-code", rules["duplicate-code"], {
        valid: [...ok(f, files, [
            "apps/core/src/main.ts",
            "apps/other/src/main.ts",
            "src/features/a/transport/graphql/a.resolver.ts",
            "src/features/b/transport/graphql/b.resolver.ts",
        ])],
        invalid: [...bad(f, files, { "apps/core/src/app.module.ts": [1] })],
    })
    f.cleanup()
})

const composed = {
    "apps/core/src/app.module.ts": "import { a } from '../../../src/features/a';\nexport const AppModule = [a];\n",
    "src/features/a/index.ts": "import { used } from '../../modules/domain/x';\nexport const a = [used];\n",
}

test("a symbol name is declared once across the production source", () => {
    const files = {
        ...composed,
        "src/modules/domain/x/index.ts": "export { InjectPrimaryEntityManager } from './x.decorators';\nexport { used } from './used';\n",
        "src/modules/domain/x/x.decorators.ts": "export const InjectPrimaryEntityManager = () => 1;\n",
        "src/modules/domain/x/used.ts": "export const used = 1;\n",
        "src/modules/domain/y/index.ts": "export { InjectPrimaryEntityManager } from './y.decorators';\n",
        "src/modules/domain/y/y.decorators.ts": "export const InjectPrimaryEntityManager = () => 2;\n",
        "src/modules/domain/r/index.ts": "export { used } from '../x';\n",
        "src/modules/domain/z/local.ts": "const used = 2;\nexport default used;\n",
        "src/modules/domain/w/local.ts": "export default 3;\n",
    }
    const f = projectFixture({ files })
    f.tester.run("duplicate-symbol", rules["duplicate-symbol"], {
        valid: [...ok(f, files, [
            "src/modules/domain/x/index.ts",
            "src/modules/domain/x/used.ts",
            "src/modules/domain/y/index.ts",
            "src/modules/domain/r/index.ts",
            "src/modules/domain/z/local.ts",
            "src/modules/domain/w/local.ts",
        ])],
        invalid: [...bad(f, files, {
            "src/modules/domain/x/x.decorators.ts": [1],
            "src/modules/domain/y/y.decorators.ts": [1],
        })],
    })
    f.cleanup()
})

test("a function, a type and an enum declared again under a public name are duplicates", () => {
    const files = {
        ...composed,
        "src/modules/domain/x/index.ts": "export { used } from './used';\nexport type { Shape } from './shape';\nexport { Kind } from './kind';\n",
        "src/modules/domain/x/used.ts": "export const used = 1;\n",
        "src/modules/domain/x/shape.ts": "export interface Shape { a: number }\n",
        "src/modules/domain/x/kind.ts": "export enum Kind { A = 'a' }\n",
        "src/modules/domain/z/private.ts": "export function used() { return 2; }\nexport type Shape = string;\nexport class Kind {}\n",
    }
    const f = projectFixture({ files })
    f.tester.run("duplicate-symbol", rules["duplicate-symbol"], {
        valid: [...ok(f, files, ["src/modules/domain/x/index.ts", "src/modules/domain/z/private.ts"])],
        invalid: [...bad(f, files, {
            "src/modules/domain/x/used.ts": [1],
            "src/modules/domain/x/shape.ts": [1],
            "src/modules/domain/x/kind.ts": [1],
        })],
    })
    f.cleanup()
})

test("an owner entry re-exports a symbol under its own name, never through an alias", () => {
    const files = {
        ...composed,
        "src/modules/domain/x/index.ts": [
            "export { inner as renamed } from './inner';",
            "export { default as Thing } from './thing';",
            "export * as ns from './ns';",
            "export type { Shape as Contract } from './shape';",
            "export { plain } from './plain';",
            "import { local } from './local';",
            "export { local as other };",
            "",
        ].join("\n"),
        "src/modules/domain/x/inner.ts": "export const inner = 1;\n",
        "src/modules/domain/x/thing.ts": "export default 1;\n",
        "src/modules/domain/x/ns.ts": "export const one = 1;\n",
        "src/modules/domain/x/shape.ts": "export type Shape = number;\n",
        "src/modules/domain/x/plain.ts": "export const plain = 1;\n",
        "src/modules/domain/x/local.ts": "export const local = 1;\n",
        "src/modules/domain/x/alias.spec.ts": "export { plain as fromSpec } from './plain';\n",
        "src/modules/domain/y/index.ts": "export { used } from './used';\nexport { same as same } from './same';\n",
        "src/modules/domain/y/used.ts": "export const used = 1;\n",
        "src/modules/domain/y/same.ts": "export const same = 1;\n",
    }
    const f = projectFixture({ files })
    f.tester.run("alias-reexport", rules["alias-reexport"], {
        valid: [...ok(f, files, [
            "src/modules/domain/x/inner.ts",
            "src/modules/domain/x/plain.ts",
            "src/modules/domain/x/alias.spec.ts",
            "src/modules/domain/y/index.ts",
            "src/modules/domain/y/used.ts",
        ])],
        invalid: [...bad(f, files, { "src/modules/domain/x/index.ts": [1, 2, 3, 4, 7] })],
    })
    f.cleanup()
})

test("an exported const, type or interface that only renames another declaration is an alias", () => {
    const files = {
        ...composed,
        "src/modules/domain/x/index.ts": "export { used } from './used';\nexport { Original, Mode, helper, Options, Shape, Config } from './original';\nexport { Renamed, Moved, Bound, Optioned, Shaped, ConfigAlias, Ns } from './aliases';\nexport { Base, Settings, limit } from './base';\nexport { Limit, Extended, Boxed, Wrapped, Packaged, Copy } from './fine';\n",
        "src/modules/domain/x/used.ts": "export const used = 1;\n",
        "src/modules/domain/x/original.ts": [
            "export class Original {}",
            "export enum Mode { On }",
            "export function helper(): number { return 1; }",
            "export interface Options { flag: boolean }",
            "export type Shape = { width: number };",
            "export const Config = { url: \"u\" };",
            "",
        ].join("\n"),
        "src/modules/domain/x/aliases.ts": [
            "import { Original, Mode, helper, Options, Shape, Config } from './original';",
            "import * as original from './original';",
            "export const Renamed = Original;",
            "export const Moved = helper;",
            "export const Bound = original.helper;",
            "export type Optioned = Options;",
            "export interface Shaped extends Shape {}",
            "export const ConfigAlias = Config;",
            "export const Ns = Mode;",
            "",
        ].join("\n"),
        "src/modules/domain/x/base.ts": "export interface Base { id: string }\nexport const Settings = { limit: 3 };\nexport const limit = 4;\n",
        "src/modules/domain/x/fine.ts": [
            "import { Base, Settings, limit } from './base';",
            "import type { Thing } from 'some-package';",
            "export const Limit = Settings.limit;",
            "export interface Extended extends Base { name: string }",
            "export type Boxed<T> = Array<T>;",
            "export type Wrapped = Base[];",
            "export type Packaged = Thing;",
            "export const Copy = limit + 1;",
            "",
        ].join("\n"),
    }
    const f = projectFixture({ files })
    f.tester.run("alias-reexport", rules["alias-reexport"], {
        valid: [...ok(f, files, [
            "src/modules/domain/x/original.ts",
            "src/modules/domain/x/base.ts",
            "src/modules/domain/x/fine.ts",
        ])],
        invalid: [...bad(f, files, { "src/modules/domain/x/aliases.ts": [3, 4, 5, 6, 7, 8, 9] })],
    })
    f.cleanup()
})
