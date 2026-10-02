import fs from "node:fs"
import test from "node:test"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

const read = (f, rel) => fs.readFileSync(f.at(rel), "utf8")
/** Clean files of the fixture: the rule reads the graph on disk, the code is the file's own text. */
const ok = (f, rels) => rels.map((rel) => ({ filename: f.at(rel), code: read(f, rel) }))
/** Violating files: [rel, ...errors]; an error is a line (messageId finding) or [line, /message/]. */
const bad = (f, list) => list.map(([rel, ...errs]) => ({
    filename: f.at(rel),
    code: read(f, rel),
    errors: errs.map((e) => (typeof e === "number" ? { messageId: "finding", line: e } : { line: e[0], message: e[1] })),
}))
/** A fixture that is removed when the test ends. */
const repo = (t, options) => {
    const f = projectFixture(options)
    t.after(f.cleanup)
    return f
}

// app-composition-only ------------------------------------------------------------------------------------------------------
test("app-composition-only: an app holds composition files only", (t) => {
    const f = repo(t, {
        files: {
            "apps/core/src/main.ts": "import { AppModule } from './app.module';\nexport const boot = AppModule;\n",
            "apps/core/src/app.module.ts": "export class AppModule {}\n",
            "apps/core/src/core.options.ts": "export interface CoreOptions { readonly port: number }\n",
            "apps/core/src/other.options.ts": "export interface OtherOptions { readonly port: number }\n",
            "apps/core/src/pricing.ts": "export const price = (n: number) => n * 2;\n",
            "apps/core/src/leaky.service.ts": "export class LeakyService { run() { return 1 } }\n",
            "src/features/a/index.ts": "export const a = 1;\n",
        },
    })
    f.tester.run("app-composition-only", rules["app-composition-only"], {
        valid: ok(f, ["apps/core/src/main.ts", "apps/core/src/app.module.ts", "apps/core/src/core.options.ts", "src/features/a/index.ts"]),
        invalid: [...bad(f, [
            ["apps/core/src/pricing.ts", [1, /BE_APP_COMPOSITION_ONLY/]],
            ["apps/core/src/other.options.ts", [1, /BE_APP_COMPOSITION_ONLY/]],
            ["apps/core/src/leaky.service.ts", [1, /BE_APP_BUSINESS_ROLE/]],
        ])],
    })
})

// entrypoint-only-in-apps ---------------------------------------------------------------------------------------------------
test("entrypoint-only-in-apps: NestFactory and bootstrap() live in an app main file", (t) => {
    const boot = "import { NestFactory } from '@nestjs/core';\nexport const boot = (module: unknown) => NestFactory.create(module);\n"
    const f = repo(t, {
        files: {
            "apps/core/src/main.ts": "import { NestFactory } from '@nestjs/core';\nimport { AppModule } from './app.module';\nasync function bootstrap() { const app = await NestFactory.create(AppModule); await app.listen(3000); }\nvoid bootstrap();\n",
            "apps/core/src/app.module.ts": "export class AppModule {}\n",
            "src/features/a/index.ts": "import { NestFactory } from '@nestjs/core';\nexport const start = (module: unknown) => NestFactory.createApplicationContext(module);\n",
            "src/tests/fixtures/boot.ts": "import * as nest from '@nestjs/core';\nexport const boot = (module: unknown) => nest.NestFactory.create(module);\n",
            "apps/core/src/other.ts": "import { NestFactory as Factory } from '@nestjs/core';\nexport const other = (module: unknown) => Factory.createMicroservice(module);\n",
            "src/features/a/one.ts": "declare function bootstrap(): Promise<void>;\nbootstrap();\n",
            "src/features/a/two.ts": "declare function bootstrap(): Promise<void>;\nvoid bootstrap();\n",
            "src/features/a/three.ts": "declare function bootstrap(): Promise<void>;\nbootstrap().catch(() => undefined);\n",
            "src/features/b/index.ts": "const NestFactory = { create: (module: unknown) => module };\nexport const fake = NestFactory.create(1);\n",
            "src/features/c/index.ts": "export const fine = (): void => { const bootstrap = (): void => undefined; bootstrap(); };\n",
            "src/tests/world/use-test-world.ts": boot,
        },
    })
    f.tester.run("entrypoint-only-in-apps", rules["entrypoint-only-in-apps"], {
        valid: ok(f, [
            "apps/core/src/main.ts",
            "src/features/b/index.ts",
            "src/features/c/index.ts",
            "src/tests/world/use-test-world.ts",
        ]),
        invalid: [...bad(f, [
            ["src/features/a/index.ts", 2],
            ["src/tests/fixtures/boot.ts", 2],
            ["apps/core/src/other.ts", 2],
            ["src/features/a/one.ts", 2],
            ["src/features/a/two.ts", 2],
            ["src/features/a/three.ts", 2],
        ])],
    })
})

// error-code-unique ---------------------------------------------------------------------------------------------------------
const errorFile = (capability, body, tier = "domain") => ({
    [`src/modules/${tier}/${capability}/index.ts`]: `export const ${capability.replace(/-/g, "_")} = 1;\n`,
    [`src/modules/${tier}/${capability}/errors/${capability}.error.ts`]: body,
})
test("error-code-unique: a code is capability-prefixed, a string literal and declared once", (t) => {
    const f = repo(t, {
        files: {
            ...errorFile("purchase", 'export enum PurchaseErrorCode {\n  OfferNotFound = "PURCHASE_OFFER_NOT_FOUND",\n  AlreadyOwned = "PURCHASE_ALREADY_OWNED",\n}\n'),
            ...errorFile("learning-path", 'export enum LearningPathErrorCode {\n  Missing = "LEARNING_PATH_MISSING",\n}\nexport enum Unrelated {\n  X = "anything",\n}\n'),
            ...errorFile("order", 'export enum OrderErrorCode {\n  Wrong = "PURCHASE_NOT_FOUND",\n  Suffix = "ORDER_NOT_FOUND_ERROR",\n  Lower = "order_lower",\n  Bare = "ORDER",\n  Computed = `ORDER_${1}`,\n  Numeric = 4,\n}\n'),
            ...errorFile("invoice", 'export enum InvoiceErrorCode {\n  A = "INVOICE_A",\n  B = "INVOICE_A",\n}\n'),
            ...errorFile("invoice-plan", 'export enum InvoicePlanErrorCode {\n  A = "INVOICE_PLAN_A",\n  Clash = "INVOICE_A",\n}\n'),
        },
    })
    f.tester.run("error-code-unique", rules["error-code-unique"], {
        valid: ok(f, ["src/modules/domain/purchase/errors/purchase.error.ts", "src/modules/domain/learning-path/errors/learning-path.error.ts"]),
        invalid: [...bad(f, [
            ["src/modules/domain/order/errors/order.error.ts", [2, /PURCHASE_NOT_FOUND" must match ORDER_/], [3, /_ERROR/], [4, /order_lower/], [5, /"ORDER"/], [6, /Computed must be a string literal/], [7, /Numeric must be a string literal/]],
            ["src/modules/domain/invoice/errors/invoice.error.ts", [2, /already declared in/], [3, /already declared in/]],
            ["src/modules/domain/invoice-plan/errors/invoice-plan.error.ts", [3, /must match INVOICE_PLAN_/]],
        ])],
    })
})

// error-masked --------------------------------------------------------------------------------------------------------------
const ERRORS = {
    "src/modules/platform/errors/index.ts": "export { AllExceptionsFilter } from './all-exceptions.filter';\nexport { formatError } from './format-error';\n",
    "src/modules/platform/errors/all-exceptions.filter.ts": "export class AllExceptionsFilter { catch(): void {} }\n",
    "src/modules/platform/errors/format-error.ts": "export const formatError = (error: unknown): unknown => error;\n",
}
const MASKED_APP = ({ providers, imports = "", extra = "" }) => `import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { AllExceptionsFilter, formatError } from '../../../src/modules/platform/errors';
${extra}
@Module({ imports: [${imports}], providers: [${providers}] })
export class AppModule {}
`
const FILTER = "{ provide: APP_FILTER, useClass: AllExceptionsFilter }"
test("error-masked: every api app wires the platform/errors filter and formatError", (t) => {
    const names = ["none", "two", "local", "factory", "lookalike", "nofmt", "ownfmt"]
    const apps = [{ name: "core", kind: "api" }, ...names.map((name) => ({ name, kind: "api" })), { name: "jobs", kind: "worker" }]
    const f = repo(t, {
        apps,
        files: {
            ...ERRORS,
            "apps/core/src/app.module.ts": MASKED_APP({ providers: FILTER, imports: "GraphQLModule.forRoot({ formatError })" }),
            "apps/none/src/app.module.ts": MASKED_APP({ providers: "" }),
            "apps/two/src/app.module.ts": MASKED_APP({ providers: `${FILTER}, ${FILTER}` }),
            "apps/local/src/app.module.ts": MASKED_APP({ providers: "{ provide: APP_FILTER, useClass: LocalFilter }", extra: "class LocalFilter { catch(): void {} }" }),
            "apps/factory/src/app.module.ts": MASKED_APP({ providers: "{ provide: APP_FILTER, useFactory: () => new AllExceptionsFilter() }" }),
            "apps/lookalike/src/app.module.ts": "import { Module } from '@nestjs/common';\nimport { APP_FILTER } from './tokens';\nimport { AllExceptionsFilter } from '../../../src/modules/platform/errors';\n@Module({ providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }] })\nexport class AppModule {}\n",
            "apps/lookalike/src/tokens.ts": 'export const APP_FILTER = "x";\n',
            "apps/nofmt/src/app.module.ts": MASKED_APP({ providers: FILTER, imports: "GraphQLModule.forRoot({ playground: false })" }),
            "apps/ownfmt/src/app.module.ts": MASKED_APP({ providers: FILTER, imports: "GraphQLModule.forRootAsync({ useFactory: () => ({ formatError: (error: unknown) => error }) })" }),
            "apps/jobs/src/app.module.ts": "export const AppModule = 1;\n",
            ...Object.fromEntries([...names, "jobs"].map((name) => [`apps/${name}/src/main.ts`, "void 0;\n"])),
        },
    })
    f.tester.run("error-masked", rules["error-masked"], {
        valid: ok(f, ["apps/core/src/app.module.ts", "apps/jobs/src/app.module.ts", "src/modules/platform/errors/all-exceptions.filter.ts"]),
        invalid: [...bad(f, [
            ["apps/none/src/app.module.ts", [1, /provides 0 APP_FILTER entries/]],
            ["apps/two/src/app.module.ts", [6, /provides 2 APP_FILTER entries/]],
            ["apps/local/src/app.module.ts", [6, /must be `useClass` of the filter declared in platform\/errors/]],
            ["apps/factory/src/app.module.ts", [6, /APP_FILTER/]],
            ["apps/lookalike/src/app.module.ts", [1, /provides 0 APP_FILTER entries/]],
            ["apps/nofmt/src/app.module.ts", [6, /must pass the `formatError` exported by platform\/errors/]],
            ["apps/ownfmt/src/app.module.ts", [6, /formatError/]],
        ])],
    })
})

// default-deny-app-guard ----------------------------------------------------------------------------------------------------
const TIER_GUARDS = [
    "import { SetMetadata } from '@nestjs/common';",
    "const TIER_KEY = 'tier';",
    "const STRAY_KEY = 'stray';",
    "export const RateLimit = (tier: string) => SetMetadata(TIER_KEY, tier);",
    "interface Reader { getAllAndOverride(key: string, targets: unknown[]): unknown }",
    "export class TierGuard { constructor(private readonly reader: Reader) {} canActivate(): boolean { return this.reader.getAllAndOverride(TIER_KEY, []) !== undefined; } }",
    "export class PlainGuard { canActivate(): boolean { return true; } }",
    "export class StrayTierGuard { constructor(private readonly reader: Reader) {} canActivate(): boolean { return this.reader.getAllAndOverride(STRAY_KEY, []) !== undefined; } }",
    "",
].join("\n")
const GUARD_FILES = {
    "src/modules/platform/http-security/index.ts": "export { CsrfOriginGuard } from './csrf-origin.guard';\nexport { AppThrottlerGuard } from './app-throttler.guard';\nexport { PlainGuard, StrayTierGuard, TierGuard } from './tier.guard';\n",
    "src/modules/platform/http-security/csrf-origin.guard.ts": "export class CsrfOriginGuard { canActivate(context: { headers: { origin?: string } }): boolean { return context.headers.origin !== undefined; } }\n",
    "src/modules/platform/http-security/app-throttler.guard.ts": "import { ThrottlerGuard } from '@nestjs/throttler';\nexport class AppThrottlerGuard extends ThrottlerGuard {}\n",
    "src/modules/platform/http-security/tier.guard.ts": TIER_GUARDS,
    "src/modules/domain/identity/index.ts": "export { AuthGuard } from './auth.guard';\nexport { Lookalike } from './lookalike';\n",
    "src/modules/domain/identity/auth.guard.ts": "export class AuthGuard { canActivate(): boolean { return true; } }\n",
    "src/modules/domain/identity/lookalike.ts": "export class Lookalike { canActivate(): boolean { return true; } }\n",
}
const GUARD_APP = (guards) => `import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppThrottlerGuard, CsrfOriginGuard, PlainGuard, StrayTierGuard, TierGuard } from '../../../src/modules/platform/http-security';
import { AuthGuard, Lookalike } from '../../../src/modules/domain/identity';
@Module({ providers: [${guards.map((name) => `{ provide: APP_GUARD, useClass: ${name} }`).join(", ")}] })
export class AppModule {}
`
test("default-deny-app-guard: an api app provides throttler, CSRF origin guard, AuthGuard in that order", (t) => {
    const T = "ThrottlerGuard"
    const C = "CsrfOriginGuard"
    const A = "AuthGuard"
    const variants = {
        core: [T, C, A],
        subclass: ["AppThrottlerGuard", C, A],
        tier: ["TierGuard", C, A],
        extra: [T, "Lookalike", C, A],
        nothrottler: [C, A],
        nocsrf: [T, A],
        noauth: [T, C],
        empty: [],
        lookalike: [T, C, "Lookalike"],
        reordered: [A, T, C],
        reordered2: [T, A, C],
        repeated: [T, C, A, A],
        swapped: [C, "TierGuard", A],
        plain: ["PlainGuard", C, A],
        stray: ["StrayTierGuard", C, A],
    }
    const names = Object.keys(variants)
    const f = repo(t, {
        apps: names.map((name) => ({ name, kind: "api" })),
        files: {
            ...GUARD_FILES,
            ...Object.fromEntries(names.flatMap((name) => [[`apps/${name}/src/app.module.ts`, GUARD_APP(variants[name])], [`apps/${name}/src/main.ts`, "void 0;\n"]])),
        },
    })
    const at = (name) => `apps/${name}/src/app.module.ts`
    f.tester.run("default-deny-app-guard", rules["default-deny-app-guard"], {
        valid: ok(f, [at("core"), at("subclass"), at("tier"), at("extra")]),
        invalid: [...bad(f, [
            [at("nothrottler"), [6, /does not provide the throttler guard/]],
            [at("nocsrf"), [6, /does not provide the CSRF origin guard/]],
            [at("noauth"), [6, /does not provide AuthGuard/]],
            [at("empty"), 1, 1, 1],
            [at("lookalike"), [6, /does not provide AuthGuard/]],
            [at("reordered"), 6],
            [at("reordered2"), 6],
            [at("repeated"), [6, /more than once/]],
            [at("swapped"), [6, /before the throttler guard/]],
            [at("plain"), [6, /does not provide the throttler guard/]],
            [at("stray"), [6, /does not provide the throttler guard/]],
        ])],
    })
})

// schema-owner --------------------------------------------------------------------------------------------------------------
const ENTITY = (klass, table) => `import { Column, Entity, PrimaryColumn } from 'typeorm';\n@Entity("${table}")\nexport class ${klass} {\n  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;\n}\n`
const MIGRATION = (klass, name = klass) => `import { MigrationInterface, QueryRunner } from 'typeorm';\nexport class ${klass} implements MigrationInterface {\n  name = "${name}";\n  async up(queryRunner: QueryRunner): Promise<void> { void queryRunner; }\n  async down(queryRunner: QueryRunner): Promise<void> { void queryRunner; }\n}\n`
const BILLING = "src/modules/domain/billing"
const CORE_APP = "apps/core/src/app.module.ts"
const DATABASE = {
    "src/modules/platform/database/index.ts": "export { sql } from './sql';\nexport { DatabaseModule } from './database.module';\n",
    "src/modules/platform/database/sql.ts": 'export const sql = (strings: TemplateStringsArray, ...values: unknown[]): string => strings.join("?") + values.length;\n',
    "src/modules/platform/database/database.module.ts": "import { Module } from '@nestjs/common';\n@Module({})\nexport class DatabaseModule {\n  static register(options: { connections: { name: string }[] }) { return { module: DatabaseModule, ...options }; }\n}\n",
}
const connection = (name, prefix, constant) => ({
    [`src/modules/platform/database/${name}.connection.ts`]: `export const ${constant}_CONNECTION = "${name}";\n`,
    [`src/modules/platform/database/${name}.decorators.ts`]: `import { getEntityManagerToken } from '@nestjs/typeorm';\nimport { ${constant}_CONNECTION } from './${name}.connection';\ndeclare function injector(token: unknown): unknown;\nexport const Inject${name[0].toUpperCase()}${name.slice(1)}EntityManager = () => injector(getEntityManagerToken(${constant}_CONNECTION));\n`,
    [`src/modules/platform/database/${name}.config.ts`]: `export const ${name}Config = () => ({ host: process.env.${prefix}_HOST, port: process.env.${prefix}_PORT, name: process.env.${prefix}_NAME });\n`,
})
const REGISTER = (literal, extra = "") => `import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../src/modules/platform/database';
import { PRIMARY_CONNECTION } from '../../../src/modules/platform/database/primary.connection';
import { AGENTOS_CONNECTION } from '../../../src/modules/platform/database/agentos.connection';
import { billingEntities, billingMigrations } from '../../../src/modules/domain/billing';
${extra}
@Module({ imports: [DatabaseModule.register({ connections: [${literal}] })] })
export class AppModule {}
`
const PRIMARY_ENTRY = "{ name: PRIMARY_CONNECTION, entities: billingEntities, migrations: billingMigrations }"
const SCHEMA_GOOD = {
    ...DATABASE,
    ...connection("primary", "PRIMARY", "PRIMARY"),
    ...connection("agentos", "AGENTOS", "AGENTOS"),
    [`${BILLING}/index.ts`]: "export { billingEntities, billingMigrations } from './persistence/connection';\n",
    [`${BILLING}/persistence/connection.ts`]: "import { InvoiceEntity } from './entities/invoice.entity';\nimport { CreateInvoices1789800000000 } from './migrations/1789800000000-create-invoices';\nexport const billingEntities = [InvoiceEntity];\nexport const billingMigrations = [CreateInvoices1789800000000];\n",
    [CORE_APP]: REGISTER(PRIMARY_ENTRY),
    "apps/core/src/main.ts": "void 0;\n",
    [`${BILLING}/persistence/entities/invoice.entity.ts`]: ENTITY("InvoiceEntity", "invoices"),
    [`${BILLING}/persistence/migrations/1789800000000-create-invoices.ts`]: MIGRATION("CreateInvoices1789800000000"),
}
const schemaRepo = (t, files) => repo(t, {
    declaration: { connections: [{ name: "primary", envPrefix: "PRIMARY" }, { name: "agentos", envPrefix: "AGENTOS" }] },
    apps: [{ name: "core", kind: "api" }, { name: "migrate", kind: "migrate" }],
    files: { ...SCHEMA_GOOD, "apps/migrate/src/main.ts": "void 0;\n", ...files },
})
const OWNER_FILES = [`${BILLING}/index.ts`, `${BILLING}/persistence/connection.ts`, `${BILLING}/persistence/entities/invoice.entity.ts`, `${BILLING}/persistence/migrations/1789800000000-create-invoices.ts`]

test("schema-owner: entities and migrations sit in the persistence folders of the owner, migrations are named by the rule", (t) => {
    const f = schemaRepo(t, {
        "src/features/a/index.ts": "export const a = 1;\n",
        "src/features/a/application/order.entity.ts": ENTITY("OrderEntity", "orders"),
        "src/features/a/migrations/1789800000001-orders.ts": MIGRATION("Orders1789800000001"),
        "src/modules/integrations/payos/index.ts": "export const p = 1;\n",
        "src/modules/integrations/payos/persistence/entities/token.entity.ts": ENTITY("TokenEntity", "tokens"),
        [`${BILLING}/persistence/migrations/1789800000002-swap.ts`]: ENTITY("SwapEntity", "swaps"),
        [`${BILLING}/persistence/entities/late.entity.ts`]: MIGRATION("Late1789800000003"),
        [`${BILLING}/persistence/migrations/1789800000004-add-column.ts`]: MIGRATION("AddColumn"),
        [`${BILLING}/persistence/migrations/1789800000005-add-index.ts`]: MIGRATION("AddIndex1789800000005", "AddIndex"),
        [`${BILLING}/persistence/migrations/20260930-late.ts`]: MIGRATION("Late20260930"),
        [`${BILLING}/persistence/migrations/1789800000000-create-invoices.spec.ts`]: "export {};\n",
    })
    f.tester.run("schema-owner", rules["schema-owner"], {
        valid: ok(f, [...OWNER_FILES, CORE_APP]),
        invalid: [...bad(f, [
            ["src/features/a/application/order.entity.ts", [3, /Entity OrderEntity is declared outside persistence\/entities\//]],
            ["src/features/a/migrations/1789800000001-orders.ts", [1, /migrations\/ folder outside the persistence/], [2, /Migration Orders1789800000001 is declared outside/]],
            ["src/modules/integrations/payos/persistence/entities/token.entity.ts", [1, /entities\/ folder outside the persistence/], [3, /Entity TokenEntity is declared outside/]],
            [`${BILLING}/persistence/migrations/1789800000002-swap.ts`, [3, /Entity SwapEntity is declared outside persistence\/entities\//]],
            [`${BILLING}/persistence/entities/late.entity.ts`, [2, /Migration Late1789800000003 is declared outside persistence\/migrations\//]],
            [`${BILLING}/persistence/migrations/1789800000004-add-column.ts`, [2, /must be named AddColumn1789800000004/]],
            [`${BILLING}/persistence/migrations/1789800000005-add-index.ts`, [3, /must declare `name = "AddIndex1789800000005"`/]],
            [`${BILLING}/persistence/migrations/20260930-late.ts`, [1, /is not named <epochMs13>/]],
            [`${BILLING}/persistence/migrations/1789800000000-create-invoices.spec.ts`, [1, /is a unit spec of a migration/]],
        ])],
    })
})

test("schema-owner: a connection the declaration does not name is refused", (t) => {
    const f = schemaRepo(t, { [CORE_APP]: REGISTER('{ name: "ledger", entities: billingEntities, migrations: billingMigrations }') })
    f.tester.run("schema-owner", rules["schema-owner"], {
        valid: ok(f, [...OWNER_FILES]),
        invalid: [...bad(f, [[CORE_APP, [7, /which hfs\.json does not declare/]]])],
    })
})

test("schema-owner: arrays nobody registers are refused", (t) => {
    const f = schemaRepo(t, { [CORE_APP]: REGISTER("{ name: PRIMARY_CONNECTION }") })
    f.tester.run("schema-owner", rules["schema-owner"], {
        valid: ok(f, [`${BILLING}/persistence/entities/invoice.entity.ts`]),
        invalid: [...bad(f, [[`${BILLING}/persistence/connection.ts`, [1, /no app registers them/]]])],
    })
})

test("schema-owner: the arrays of one capability on two connections are refused", (t) => {
    const f = schemaRepo(t, { [CORE_APP]: REGISTER(`${PRIMARY_ENTRY}, { name: AGENTOS_CONNECTION, entities: billingEntities }`) })
    f.tester.run("schema-owner", rules["schema-owner"], {
        valid: ok(f, [`${BILLING}/persistence/entities/invoice.entity.ts`]),
        invalid: [...bad(f, [[CORE_APP, [7, /exactly one connection/]]])],
    })
})

test("schema-owner: the same connection in two apps, through a spread options property, is fine; a foreign entity manager is not", (t) => {
    const f = schemaRepo(t, {
        "apps/core/src/core.options.ts": 'export interface Options { database: { name: string } }\nexport const options: Options = { database: { name: "primary" } };\n',
        [CORE_APP]: REGISTER("{ ...options.database, entities: billingEntities, migrations: billingMigrations }", "import { options } from './core.options';"),
        "apps/migrate/src/main.ts": REGISTER(PRIMARY_ENTRY),
        [`${BILLING}/invoice.writer.ts`]: "import { InjectPrimaryEntityManager } from '../../platform/database/primary.decorators';\nexport const write = () => InjectPrimaryEntityManager();\n",
        [`${BILLING}/invoice.reader.ts`]: "import { InjectAgentosEntityManager } from '../../platform/database/agentos.decorators';\nexport const read = () => InjectAgentosEntityManager();\n",
    })
    f.tester.run("schema-owner", rules["schema-owner"], {
        valid: ok(f, [CORE_APP, "apps/migrate/src/main.ts", `${BILLING}/invoice.writer.ts`]),
        invalid: [...bad(f, [[`${BILLING}/invoice.reader.ts`, [2, /injects the entity manager of connection agentos, but the billing capability/]]])],
    })
})

test("schema-owner: a connection reached through a config call that names another connection is refused", (t) => {
    const f = schemaRepo(t, { [CORE_APP]: REGISTER(`${PRIMARY_ENTRY}, { ...parse(), entities: billingEntities, migrations: [...billingMigrations] }`, "const parse = () => ({ name: AGENTOS_CONNECTION });") })
    f.tester.run("schema-owner", rules["schema-owner"], {
        valid: ok(f, [`${BILLING}/persistence/entities/invoice.entity.ts`]),
        invalid: [...bad(f, [[CORE_APP, [7, /exactly one connection/]]])],
    })
})

test("schema-owner: the owner index exports <c>Entities and <c>Migrations and nothing else of persistence", (t) => {
    const missing = schemaRepo(t, { [`${BILLING}/index.ts`]: "export { billingEntities } from './persistence/connection';\n" })
    missing.tester.run("schema-owner", rules["schema-owner"], {
        valid: ok(missing, [`${BILLING}/persistence/entities/invoice.entity.ts`]),
        invalid: [...bad(missing, [[`${BILLING}/index.ts`, [1, /must export billingMigrations/]]])],
    })
    const extra = schemaRepo(t, { [`${BILLING}/index.ts`]: "export { billingEntities, billingMigrations } from './persistence/connection';\nexport { InvoiceEntity } from './persistence/entities/invoice.entity';\n" })
    extra.tester.run("schema-owner", rules["schema-owner"], {
        valid: ok(extra, [`${BILLING}/persistence/entities/invoice.entity.ts`]),
        invalid: [...bad(extra, [[`${BILLING}/index.ts`, [2, /InvoiceEntity is exported from persistence/]]])],
    })
})

// register-once -------------------------------------------------------------------------------------------------------------
const MODULE = (name, imports = "") => `import { Module } from '@nestjs/common';
${imports ? `${imports.split(";")[0]};\n` : ""}@Module({ ${imports ? `imports: [${imports.split(";")[1]}]` : ""} })
export class ${name} {
  static register(options: { isGlobal?: boolean }) { return { module: ${name}, ...options }; }
}
`
const REPRESENTATIVES = {
    "src/modules/platform/config/index.ts": "export { ConfigModule } from './config.module';\n",
    "src/modules/platform/config/config.module.ts": MODULE("ConfigModule"),
    "src/modules/domain/billing/index.ts": "export { BillingModule } from './billing.module';\n",
    "src/modules/domain/billing/billing.module.ts": MODULE("BillingModule", "import { InvoiceModule } from './invoice.module';InvoiceModule"),
    "src/modules/domain/billing/invoice.module.ts": MODULE("InvoiceModule"),
}
const FEATURE_A = {
    "src/features/a/index.ts": "export { AGraphqlModule } from './transport/graphql/a-graphql.module';\nexport { AHttpModule } from './transport/http/a-http.module';\n",
    "src/features/a/a.module.ts": "import { Module } from '@nestjs/common';\n@Module({})\nexport class AModule {}\n",
    "src/features/a/transport/graphql/a-graphql.module.ts": "import { Module } from '@nestjs/common';\nimport { AModule } from '../../a.module';\n@Module({ imports: [AModule] })\nexport class AGraphqlModule {}\n",
    "src/features/a/transport/http/a-http.module.ts": "import { Module } from '@nestjs/common';\nimport { AModule } from '../../a.module';\n@Module({ imports: [AModule] })\nexport class AHttpModule {}\n",
}
const ROOT_APP = (imports) => `import { Module } from '@nestjs/common';
import { ConfigModule } from '../../../src/modules/platform/config';
import { BillingModule } from '../../../src/modules/domain/billing';
import { AGraphqlModule, AHttpModule } from '../../../src/features/a';
@Module({ imports: [${imports.join(", ")}] })
export class AppModule {}
`
const ROOT_GOOD = ["ConfigModule.register({ isGlobal: true })", "BillingModule.register({ isGlobal: true })", "AGraphqlModule", "AHttpModule"]
const COMPOSE = "import { ConfigModule } from '../../modules/platform/config';\nimport { BillingModule } from '../../modules/domain/billing';\nexport const modules = [ConfigModule.register({ isGlobal: true }), BillingModule.register({ isGlobal: true })];\nexport const own = { imports: [BillingModule], isGlobal: true };\n"
const CLEAN_TREE = ["src/modules/platform/config/config.module.ts", "src/modules/domain/billing/billing.module.ts", "src/modules/domain/billing/invoice.module.ts", "src/features/a/a.module.ts", "src/features/a/transport/graphql/a-graphql.module.ts", "src/features/a/transport/http/a-http.module.ts", "apps/core/src/app.module.ts"]
const rootRepo = (t, files, apps) => repo(t, { apps, files: { ...REPRESENTATIVES, ...FEATURE_A, "apps/core/src/app.module.ts": ROOT_APP(ROOT_GOOD), ...files } })
const onceRepo = (t, files) => rootRepo(t, files)

test("register-once: representatives registered once with isGlobal true, a sub-module with one importer, isGlobal only in an app root", (t) => {
    const f = rootRepo(t, {
        "apps/jobs/src/main.ts": "void 0;\n",
        "apps/jobs/src/app.module.ts": ROOT_APP(ROOT_GOOD.slice(0, 2)),
        "src/modules/platform/config/config.options.ts": "export const off = { isGlobal: false };\nexport const own = { isGlobal: true };\n",
        "src/tests/world/use-test-world.ts": COMPOSE,
        "src/tests/fixtures/compose.ts": COMPOSE,
        "src/features/a/compose.ts": COMPOSE,
    }, [{ name: "core", kind: "api" }, { name: "jobs", kind: "worker" }])
    f.tester.run("register-once", rules["register-once"], {
        valid: ok(f, [...CLEAN_TREE, "apps/jobs/src/app.module.ts", "src/tests/world/use-test-world.ts"]),
        invalid: [...bad(f, [
            ["src/modules/platform/config/config.options.ts", [2, /`isGlobal: true` appears only in the app root/]],
            ["src/tests/fixtures/compose.ts", [3, /isGlobal: true/], [3, /isGlobal: true/], [4, /BillingModule is registered in the root of app core, jobs/], [4, /isGlobal: true/]],
            ["src/features/a/compose.ts", [3, /isGlobal: true/], [3, /isGlobal: true/], [4, /BillingModule is registered in the root of app core, jobs/], [4, /isGlobal: true/]],
        ])],
    })
})

test("register-once: a module listed twice in an app root, directly or through a helper, is refused", (t) => {
    const twice = onceRepo(t, { "apps/core/src/app.module.ts": ROOT_APP([...ROOT_GOOD, "ConfigModule.register({ isGlobal: true })"]) })
    twice.tester.run("register-once", rules["register-once"], {
        valid: ok(twice, CLEAN_TREE.slice(0, 6)),
        invalid: [...bad(twice, [["apps/core/src/app.module.ts", [5, /registered more than once/]]])],
    })
    const helper = onceRepo(t, {
        "apps/core/src/app.module.ts": `import { Module } from '@nestjs/common';
import { ConfigModule } from '../../../src/modules/platform/config';
import { BillingModule } from '../../../src/modules/domain/billing';
const shared = () => [ConfigModule.register({ isGlobal: true })];
@Module({ imports: [...shared(), ConfigModule.register({ isGlobal: true }), BillingModule.register({ isGlobal: true })] })
export class AppModule {}
`,
    })
    helper.tester.run("register-once", rules["register-once"], {
        valid: ok(helper, CLEAN_TREE.slice(0, 3)),
        invalid: [...bad(helper, [["apps/core/src/app.module.ts", [5, /registered more than once/]]])],
    })
})

test("register-once: a capability module at the app root without the literal isGlobal true, or as a bare class, is refused", (t) => {
    const noGlobal = onceRepo(t, { "apps/core/src/app.module.ts": ROOT_APP(["ConfigModule.register({ isGlobal: false })", "BillingModule.register({})", "AGraphqlModule", "AHttpModule"]) })
    noGlobal.tester.run("register-once", rules["register-once"], {
        valid: ok(noGlobal, CLEAN_TREE.slice(0, 3)),
        invalid: [...bad(noGlobal, [["apps/core/src/app.module.ts", [5, /ConfigModule is registered in the app root without the literal `isGlobal: true`/], [5, /BillingModule is registered in the app root without the literal/]]])],
    })
    const bare = onceRepo(t, { "apps/core/src/app.module.ts": ROOT_APP(["ConfigModule", "BillingModule.register({ isGlobal: true })", "AGraphqlModule", "AHttpModule"]) })
    bare.tester.run("register-once", rules["register-once"], {
        valid: ok(bare, CLEAN_TREE.slice(0, 3)),
        invalid: [...bad(bare, [["apps/core/src/app.module.ts", [5, /listed in imports as a bare class/]]])],
    })
})

test("register-once: a module importing another capability's registered module is refused at the importer", (t) => {
    const f = onceRepo(t, {
        "src/modules/domain/invoices/index.ts": "export { InvoicesModule } from './invoices.module';\n",
        "src/modules/domain/invoices/invoices.module.ts": "import { Module } from '@nestjs/common';\nimport { ConfigModule } from '../../platform/config';\nimport { BillingModule } from '../billing';\n@Module({ imports: [ConfigModule, BillingModule.register({})] })\nexport class InvoicesModule {}\n",
    })
    f.tester.run("register-once", rules["register-once"], {
        valid: ok(f, CLEAN_TREE),
        invalid: [...bad(f, [["src/modules/domain/invoices/invoices.module.ts", [4, /ConfigModule is registered in the root of app core, so no other module imports it/], [4, /BillingModule is registered in the root of app core, so no other module imports it/]]])],
    })
})

test("register-once: a sub-module imported by two modules, or also listed in an app root, is refused", (t) => {
    const two = onceRepo(t, {
        "src/modules/domain/shipping/index.ts": "export { ShippingModule } from './shipping.module';\n",
        "src/modules/domain/shipping/shipping.module.ts": "import { Module } from '@nestjs/common';\nimport { InvoiceModule } from '../billing/invoice.module';\n@Module({ imports: [InvoiceModule] })\nexport class ShippingModule {}\n",
    })
    two.tester.run("register-once", rules["register-once"], {
        valid: ok(two, CLEAN_TREE),
        invalid: [...bad(two, [["src/modules/domain/shipping/shipping.module.ts", [3, /InvoiceModule is imported by 2 modules/]]])],
    })
    const listed = onceRepo(t, {
        "apps/core/src/app.module.ts": ROOT_APP([...ROOT_GOOD, "InvoiceModule"]).replace("import { BillingModule }", "import { InvoiceModule } from '../../../src/modules/domain/billing/invoice.module';\nimport { BillingModule }"),
    })
    listed.tester.run("register-once", rules["register-once"], {
        valid: ok(listed, ["src/modules/platform/config/config.module.ts", "src/features/a/a.module.ts"]),
        invalid: [...bad(listed, [
            ["apps/core/src/app.module.ts", [6, /InvoiceModule is listed in imports as a bare class/]],
            ["src/modules/domain/billing/billing.module.ts", [3, /InvoiceModule is registered in the root of app core/]],
        ])],
    })
})

test("register-once: the feature case is bounded to the feature owner: another feature importing the application module is a second importer", (t) => {
    const f = onceRepo(t, {
        "src/features/b/index.ts": "export { BModule } from './b.module';\n",
        "src/features/b/b.module.ts": "import { Module } from '@nestjs/common';\nimport { AModule } from '../a/a.module';\n@Module({ imports: [AModule] })\nexport class BModule {}\n",
    })
    f.tester.run("register-once", rules["register-once"], {
        valid: ok(f, CLEAN_TREE.slice(0, 3)),
        invalid: [...bad(f, [
            ["src/features/a/transport/http/a-http.module.ts", [3, /AModule is imported by 3 modules/]],
            ["src/features/b/b.module.ts", [3, /AModule is imported by 3 modules/]],
        ])],
    })
})

// module-per-transport ------------------------------------------------------------------------------------------------------
const TRANSPORT_MODULE = (name, imports = "", importLine = "") => `import { Module } from '@nestjs/common';\n${importLine}@Module({ imports: [${imports}] })\nexport class ${name} {}\n`
const TRANSPORT_FEATURE = {
    "src/features/a/index.ts": "export { AGraphqlModule } from './transport/graphql/a-graphql.module';\nexport { AMessageModule } from './transport/message/a-message.module';\nexport { AModule } from './a.module';\n",
    "src/features/a/a.module.ts": TRANSPORT_MODULE("AModule"),
    "src/features/a/transport/graphql/a-graphql.module.ts": TRANSPORT_MODULE("AGraphqlModule", "AModule", "import { AModule } from '../../a.module';\n"),
    "src/features/a/transport/message/a-message.module.ts": TRANSPORT_MODULE("AMessageModule", "AModule", "import { AModule } from '../../a.module';\n"),
}
const TRANSPORT_APP = (imports, names = imports) => `import { Module } from '@nestjs/common';\nimport { ${names} } from '../../../src/features/a';\n@Module({ imports: [${imports}] })\nexport class AppModule {}\n`
const TRANSPORT_APPS = [{ name: "core", kind: "api" }, { name: "jobs", kind: "worker" }]
const transportRepo = (t, files) => repo(t, {
    apps: TRANSPORT_APPS,
    files: { ...TRANSPORT_FEATURE, "apps/core/src/app.module.ts": TRANSPORT_APP("AGraphqlModule"), "apps/jobs/src/main.ts": "void 0;\n", "apps/jobs/src/app.module.ts": TRANSPORT_APP("AMessageModule"), ...files },
})
const TRANSPORT_CLEAN = ["src/features/a/transport/graphql/a-graphql.module.ts", "src/features/a/transport/message/a-message.module.ts", "apps/core/src/app.module.ts", "apps/jobs/src/app.module.ts"]

test("module-per-transport: one module per transport folder, none per operation, no module-definition in a feature", (t) => {
    const f = transportRepo(t, {
        "src/features/a/transport/graphql/run.module.ts": TRANSPORT_MODULE("RunModule"),
        "src/features/a/application/run.handler.ts": TRANSPORT_MODULE("RunHandlerModule"),
        "src/features/a/a.module-definition.ts": "import { ConfigurableModuleBuilder } from '@nestjs/common';\nexport const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<{ x: number }>().build();\n",
    })
    f.tester.run("module-per-transport", rules["module-per-transport"], {
        valid: ok(f, TRANSPORT_CLEAN),
        invalid: [...bad(f, [
            ["src/features/a/transport/graphql/run.module.ts", [1, /second module of the graphql transport/], [3, /RunModule is a Nest module declared in/]],
            ["src/features/a/application/run.handler.ts", [3, /RunHandlerModule is a Nest module declared in/]],
            ["src/features/a/a.module-definition.ts", [1, /module-definition inside feature a/], [2, /ConfigurableModuleBuilder/]],
        ])],
    })
})

test("module-per-transport: an app imports only the transport modules its kind composes, never a feature application module", (t) => {
    const wrongKind = transportRepo(t, {
        "apps/core/src/app.module.ts": TRANSPORT_APP("AGraphqlModule, AMessageModule"),
        "apps/jobs/src/app.module.ts": TRANSPORT_APP("AMessageModule, AGraphqlModule"),
    })
    wrongKind.tester.run("module-per-transport", rules["module-per-transport"], {
        valid: ok(wrongKind, [...TRANSPORT_CLEAN.slice(0, 2), "apps/core/src/app.module.ts"]),
        invalid: [...bad(wrongKind, [
            ["apps/jobs/src/app.module.ts", [3, /composes message transports only/]],
        ])],
    })
    const application = transportRepo(t, { "apps/core/src/app.module.ts": TRANSPORT_APP("AGraphqlModule, AModule") })
    application.tester.run("module-per-transport", rules["module-per-transport"], {
        valid: ok(application, [...TRANSPORT_CLEAN.slice(0, 2), "apps/jobs/src/app.module.ts"]),
        invalid: [...bad(application, [["apps/core/src/app.module.ts", [3, /application module of feature a/]]])],
    })
})

// module-registration -------------------------------------------------------------------------------------------------------
const NEST_TYPES = {
    "node_modules/@nestjs/common/package.json": '{"name":"@nestjs/common","types":"index.d.ts"}',
    "node_modules/@nestjs/common/index.d.ts": "export declare function Module(metadata: Record<string, unknown>): ClassDecorator;\n",
    "node_modules/@nestjs/cqrs/package.json": '{"name":"@nestjs/cqrs","types":"index.d.ts"}',
    "node_modules/@nestjs/cqrs/index.d.ts": "export declare function CommandHandler(message: unknown): ClassDecorator; export declare function QueryHandler(message: unknown): ClassDecorator;\n",
}
test("module-registration: a provider registered twice and a handler no module registers are refused", (t) => {
    const f = repo(t, {
        files: {
            ...NEST_TYPES,
            "src/modules/domain/catalog/catalog.service.ts": "export class CatalogService {}\n",
            "src/modules/domain/catalog/catalog.module.ts": 'import { Module } from "@nestjs/common"; import { CatalogService } from "./catalog.service"; @Module({providers:[CatalogService,CatalogService],exports:[CatalogService]}) export class CatalogModule {}\n',
            "src/features/orders/create.command.ts": "export class CreateOrderCommand {}\n",
            "src/features/orders/create.handler.ts": 'import { CommandHandler } from "@nestjs/cqrs"; import { CreateOrderCommand } from "./create.command"; @CommandHandler(CreateOrderCommand) export class CreateOrderHandler {}\n',
            "src/features/orders/orders.module.ts": 'import { Module } from "@nestjs/common"; import { CatalogService } from "../../modules/domain/catalog/catalog.service"; import { CreateOrderHandler } from "./create.handler"; @Module({providers:[{provide:CatalogService as unknown as typeof CatalogService,useClass:CatalogService},CreateOrderHandler,CreateOrderHandler]}) export class OrdersModule {}\n',
        },
    })
    f.tester.run("module-registration", rules["module-registration"], {
        valid: ok(f, ["src/modules/domain/catalog/catalog.service.ts", "src/features/orders/create.command.ts"]),
        invalid: [...bad(f, [
            ["src/modules/domain/catalog/catalog.module.ts", [1, /registered again by CatalogModule/]],
            ["src/features/orders/orders.module.ts", [1, /registered again by OrdersModule/]],
            ["src/features/orders/create.handler.ts", [1, /CreateOrderHandler has multiple direct module registrations/]],
        ])],
    })
})

test("module-registration: a handler registered by one module, a provider by its owner, and no CQRS forced where no handler exists", (t) => {
    const f = repo(t, {
        files: {
            ...NEST_TYPES,
            "src/modules/platform/framework/index.ts": 'export { Module as NestModule } from "@nestjs/common"; export { CommandHandler as HandlesCommand } from "@nestjs/cqrs";\n',
            "src/modules/domain/catalog/catalog.service.ts": "export class CatalogService {}\n",
            "src/modules/domain/catalog/catalog.module.ts": 'import { NestModule } from "../../platform/framework"; import { CatalogService } from "./catalog.service"; const StaticModule=NestModule; @StaticModule({providers:[CatalogService],exports:[CatalogService]}) export class CatalogModule {}\n',
            "src/features/orders/application/create.command.ts": "export class CreateOrderCommand {}\n",
            "src/features/orders/application/create.handler.ts": 'import { HandlesCommand } from "../../../modules/platform/framework"; import { CreateOrderCommand } from "./create.command"; const SelectedHandler=HandlesCommand; @SelectedHandler(CreateOrderCommand) export class CreateOrderHandler {}\n',
            "src/features/orders/orders.module.ts": 'import { NestModule } from "../../modules/platform/framework"; import { CatalogModule } from "../../modules/domain/catalog/catalog.module"; import { CatalogService } from "../../modules/domain/catalog/catalog.service"; import { CreateOrderHandler } from "./application/create.handler"; @NestModule({imports:[CatalogModule],providers:[CreateOrderHandler,{provide:"LOCAL_CATALOG",useClass:CatalogService}]}) export class OrdersModule {}\n',
            "src/modules/domain/plain/plain.module.ts": 'import { Module } from "@nestjs/common"; @Module({}) export class PlainModule {}\n',
            "src/features/orders/application/stray.command.ts": "export class StrayCommand {}\n",
            "src/features/orders/application/stray.handler.ts": 'import { CommandHandler } from "@nestjs/cqrs"; import { StrayCommand } from "./stray.command"; @CommandHandler(StrayCommand) export class StrayHandler {}\n',
        },
    })
    f.tester.run("module-registration", rules["module-registration"], {
        valid: ok(f, [
            "src/modules/domain/catalog/catalog.module.ts",
            "src/features/orders/orders.module.ts",
            "src/features/orders/application/create.handler.ts",
            "src/modules/domain/plain/plain.module.ts",
        ]),
        invalid: [...bad(f, [["src/features/orders/application/stray.handler.ts", [1, /StrayHandler is not registered as a direct class-token provider/]]])],
    })
})

// background-unowned --------------------------------------------------------------------------------------------------------
const PROCESSOR = "export class SweepProcessor {\n  async process(): Promise<void> { return Promise.resolve(); }\n}\n"
const JOB_MODULE = "import { Module } from '@nestjs/common';\nimport { SweepProcessor } from './sweep.processor';\n@Module({ providers: [SweepProcessor] })\nexport class SweepModule {}\n"
const WORKER_APP = "import { Module } from '@nestjs/common';\nimport { SweepModule } from '../../../src/features/jobs/sweep';\n@Module({ imports: [SweepModule] })\nexport class AppModule {}\n"
const BILLING_SERVICE = {
    "src/modules/domain/billing/index.ts": "export { BillingService } from './billing.service';\n",
    "src/modules/domain/billing/billing.service.ts": "export class BillingService {\n  async sweepExpired(): Promise<number> { return 0; }\n}\n",
}
const JOB_FEATURE = {
    "src/features/jobs/sweep/index.ts": "export { SweepModule } from './sweep.module';\n",
    "src/features/jobs/sweep/sweep.module.ts": JOB_MODULE,
    "src/features/jobs/sweep/application/purge.handler.ts": "import { BillingService } from '../../../../modules/domain/billing';\nexport class PurgeHandler {\n  constructor(private readonly billing: BillingService) {}\n  purge(): Promise<number> { return this.billing.sweepExpired(); }\n}\n",
    "src/features/jobs/sweep/sweep.processor.ts": PROCESSOR,
}
const BACKGROUND_APPS = [{ name: "core", kind: "api" }, { name: "jobs", kind: "worker" }]
const backgroundRepo = (t, files, apps = BACKGROUND_APPS) => repo(t, { apps, declaration: { patterns: ["fenced-job"] }, files: { ...BILLING_SERVICE, ...JOB_FEATURE, "apps/jobs/src/main.ts": "void 0;\n", "apps/jobs/src/app.module.ts": WORKER_APP, ...files } })
const JOB_CLEAN = ["src/features/jobs/sweep/sweep.processor.ts", "src/features/jobs/sweep/sweep.module.ts", "src/modules/domain/billing/billing.service.ts", "apps/jobs/src/app.module.ts"]

test("background-unowned: a processor a worker app composes, and a background method it reaches, are owned; an unreached method is not", (t) => {
    const f = backgroundRepo(t, {
        "src/modules/domain/payments/index.ts": "export { PaymentsService } from './payments.service';\n",
        "src/modules/domain/payments/payments.service.ts": "export class PaymentsService {\n  async deliverReceipts(): Promise<void> {}\n  async reconcile(): Promise<void> {}\n  async retryFailed(): Promise<void> {}\n  async delivery(): Promise<void> {}\n}\n",
    })
    f.tester.run("background-unowned", rules["background-unowned"], {
        valid: ok(f, JOB_CLEAN),
        invalid: [...bad(f, [
            ["src/modules/domain/payments/payments.service.ts", [2, /deliverReceipts is background work/], [3, /reconcile is background work/], [4, /retryFailed is background work/]],
        ])],
    })
})

test("background-unowned: a processor and a consumer no worker or api app composes are refused", (t) => {
    const f = backgroundRepo(t, {
        "apps/jobs/src/app.module.ts": "import { Module } from '@nestjs/common';\n@Module({})\nexport class AppModule {}\n",
        "src/features/b/index.ts": "export const b = 1;\n",
        "src/features/b/transport/message/paid.consumer.ts": "export class PaidConsumer {}\n",
    })
    f.tester.run("background-unowned", rules["background-unowned"], {
        valid: ok(f, ["src/modules/domain/billing/index.ts", "src/features/jobs/sweep/sweep.module.ts", "src/features/b/index.ts"]),
        invalid: [...bad(f, [
            ["src/features/jobs/sweep/sweep.processor.ts", [1, /is a processor that no service app composes/]],
            ["src/features/b/transport/message/paid.consumer.ts", [1, /is a consumer that no service app composes/]],
            ["src/modules/domain/billing/billing.service.ts", [2, /sweepExpired is background work/]],
        ])],
    })
})

test("background-unowned: a processor with no worker app declared is refused", (t) => {
    const f = backgroundRepo(t, { "apps/jobs/src/app.module.ts": null, "apps/jobs/src/main.ts": null }, [{ name: "core", kind: "api" }])
    f.tester.run("background-unowned", rules["background-unowned"], {
        valid: ok(f, ["src/modules/domain/billing/index.ts", "src/features/jobs/sweep/sweep.module.ts"]),
        invalid: [...bad(f, [["src/features/jobs/sweep/sweep.processor.ts", [1, /declares no worker app/]]])],
    })
})
