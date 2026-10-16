// proves: BE_MODULE_SHAPE@lite
// proves: BE_MODULE_SHAPE@full
// proves: BE_MODULE_HANDLER_REGISTRATION@lite
// proves: BE_MODULE_HANDLER_REGISTRATION@full
// proves: BE_MODULE_PROVIDER_REREGISTRATION@lite
// proves: BE_MODULE_PROVIDER_REREGISTRATION@full
import fs from "node:fs"
import test from "node:test"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

const NEST_TYPES = {
    "node_modules/@nestjs/common/package.json": '{"name":"@nestjs/common","types":"index.d.ts"}',
    "node_modules/@nestjs/common/index.d.ts": "export declare function Module(metadata: Record<string, unknown>): ClassDecorator;\n",
    "node_modules/@nestjs/cqrs/package.json": '{"name":"@nestjs/cqrs","types":"index.d.ts"}',
    "node_modules/@nestjs/cqrs/index.d.ts": "export declare function CommandHandler(message: unknown): ClassDecorator; export declare function QueryHandler(message: unknown): ClassDecorator;\n",
}
const APP_MODULE = "apps/core/src/app.module.ts"
const source = (f, rel) => ({ filename: f.at(rel), code: fs.readFileSync(f.at(rel), "utf8") })
const violation = (f, rel, ...messages) => ({ ...source(f, rel), errors: messages.map((message) => ({ message })) })
const repo = (t, edition, files, options = {}) => {
    const f = projectFixture({ edition, ...options, files: { ...NEST_TYPES, ...files } })
    t.after(f.cleanup)
    return f
}

const REGISTER_MODULES = {
    "src/modules/platform/config/index.ts": "export { ConfigModule } from './config.module';\n",
    "src/modules/platform/config/config.module.ts": "import { Module } from '@nestjs/common'; @Module({}) export class ConfigModule { static register(options: { isGlobal: boolean }) { return { module: ConfigModule, ...options }; } }\n",
    "src/modules/domain/billing/index.ts": "export { BillingModule } from './billing.module';\n",
    "src/modules/domain/billing/billing.module.ts": "import { Module } from '@nestjs/common'; @Module({}) export class BillingModule { static register(options: { isGlobal: boolean }) { return { module: BillingModule, ...options }; } }\n",
}
const registeredApp = (imports) => "import { Module } from '@nestjs/common';\n"
    + "import { ConfigModule } from '../../../src/modules/platform/config';\n"
    + "import { BillingModule } from '../../../src/modules/domain/billing';\n"
    + `@Module({ imports: [${imports}] }) export class AppModule {}\n`

const TRANSPORT_MODULE = "src/features/api/a/transport/graphql/a-graphql.module.ts"
const SECOND_TRANSPORT_MODULE = "src/features/api/a/transport/graphql/run.module.ts"
const TRANSPORT_FEATURE = {
    "src/features/api/a/index.ts": "export { AGraphqlModule } from './transport/graphql/a-graphql.module';\n",
    "src/features/api/a/a.module.ts": "import { Module } from '@nestjs/common'; @Module({}) export class AModule {}\n",
    [TRANSPORT_MODULE]: "import { Module } from '@nestjs/common'; import { AModule } from '../../a.module'; @Module({imports:[AModule]}) export class AGraphqlModule {}\n",
    [APP_MODULE]: "import { Module } from '@nestjs/common'; import { AGraphqlModule } from '../../../src/features/api/a'; @Module({imports:[AGraphqlModule]}) export class AppModule {}\n",
}

const CATALOG_MODULE = "src/modules/domain/catalog/catalog.module.ts"
const HANDLER = "src/features/api/orders/application/create.handler.ts"
const ORDERS_MODULE = "src/features/api/orders/orders.module.ts"
const STRAY_HANDLER = "src/features/api/orders/application/stray.handler.ts"
const REGISTERED_PROVIDERS = {
    "src/modules/domain/catalog/catalog.service.ts": "export class CatalogService {}\n",
    [CATALOG_MODULE]: 'import { Module } from "@nestjs/common"; import { CatalogService } from "./catalog.service"; @Module({providers:[CatalogService],exports:[CatalogService]}) export class CatalogModule {}\n',
    "src/features/api/orders/application/create.command.ts": "export class CreateOrderCommand {}\n",
    [HANDLER]: 'import { CommandHandler } from "@nestjs/cqrs"; import { CreateOrderCommand } from "./create.command"; @CommandHandler(CreateOrderCommand) export class CreateOrderHandler {}\n',
    [ORDERS_MODULE]: 'import { Module } from "@nestjs/common"; import { CatalogModule } from "../../../modules/domain/catalog/catalog.module"; import { CreateOrderHandler } from "./application/create.handler"; @Module({imports:[CatalogModule],providers:[CreateOrderHandler]}) export class OrdersModule {}\n',
}

for (const edition of ["lite", "full"]) {
    test(`R45 register-once ${edition}: each capability is registered once`, (t) => {
        const duplicateApp = "apps/duplicate/src/app.module.ts"
        const f = repo(t, edition, {
            ...REGISTER_MODULES,
            [APP_MODULE]: registeredApp("ConfigModule.register({isGlobal:true}), BillingModule.register({isGlobal:true})"),
            [duplicateApp]: registeredApp("ConfigModule.register({isGlobal:true}), ConfigModule.register({isGlobal:true}), BillingModule.register({isGlobal:true})"),
            "apps/duplicate/src/main.ts": "void 0;\n",
        }, {
            apps: [{ name: "core", kind: "api" }, { name: "duplicate", kind: "api" }],
        })
        f.tester.run("register-once", rules["register-once"], {
            valid: [source(f, APP_MODULE)],
            invalid: [violation(f, duplicateApp, /registered more than once/)],
        })
    })

    test(`R45 module-per-transport ${edition}: a transport has one module`, (t) => {
        const f = repo(t, edition, {
            ...TRANSPORT_FEATURE,
            [SECOND_TRANSPORT_MODULE]: "import { Module } from '@nestjs/common'; @Module({imports:[]}) export class RunModule {}\n",
        })
        f.tester.run("module-per-transport", rules["module-per-transport"], {
            valid: [source(f, TRANSPORT_MODULE)],
            invalid: [violation(f, SECOND_TRANSPORT_MODULE, /second module/, /Nest module declared in/)],
        })
    })

    test(`R45 module-registration ${edition}: providers and handlers have one registration`, (t) => {
        const billingModule = "src/modules/domain/billing/billing.module.ts"
        const f = repo(t, edition, {
            ...REGISTERED_PROVIDERS,
            "src/modules/domain/billing/billing.service.ts": "export class BillingService {}\n",
            [billingModule]: 'import { Module } from "@nestjs/common"; import { BillingService } from "./billing.service"; @Module({providers:[BillingService],exports:[BillingService]}) export class BillingModule {}\n',
            [CATALOG_MODULE]: 'import { Module } from "@nestjs/common"; import { CatalogService } from "./catalog.service"; @Module({providers:[CatalogService,CatalogService],exports:[CatalogService]}) export class CatalogModule {}\n',
            "src/features/api/orders/application/stray.command.ts": "export class StrayCommand {}\n",
            [STRAY_HANDLER]: 'import { CommandHandler } from "@nestjs/cqrs"; import { StrayCommand } from "./stray.command"; @CommandHandler(StrayCommand) export class StrayHandler {}\n',
        })
        f.tester.run("module-registration", rules["module-registration"], {
            valid: [source(f, billingModule), source(f, HANDLER), source(f, ORDERS_MODULE)],
            invalid: [
                violation(f, CATALOG_MODULE, /registered again by CatalogModule/),
                violation(f, STRAY_HANDLER, /StrayHandler is not registered as a direct class-token provider/),
            ],
        })
    })
}
