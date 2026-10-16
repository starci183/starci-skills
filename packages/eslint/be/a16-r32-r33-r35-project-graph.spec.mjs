// proves: BE_APP_COMPOSITION_ONLY@lite BE_APP_COMPOSITION_ONLY@full
// proves: BE_APP_BUSINESS_ROLE@lite BE_APP_BUSINESS_ROLE@full
// proves: BE_ENTRYPOINT_ONLY_IN_APPS@lite BE_ENTRYPOINT_ONLY_IN_APPS@full
// proves: BE_SCHEMA_OWNER@lite BE_SCHEMA_OWNER@full
import fs from "node:fs"
import test from "node:test"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

const repo = (t, options) => {
    const fixture = projectFixture(options)
    t.after(fixture.cleanup)
    return fixture
}
const source = (fixture, relative) => ({ filename: fixture.at(relative), code: fs.readFileSync(fixture.at(relative), "utf8") })
const invalid = (fixture, relative, line, message) => ({ ...source(fixture, relative), errors: [{ line, message }] })

const MAIN = "apps/core/src/main.ts"
const APP = "apps/core/src/app.module.ts"
const BOOT = "import { NestFactory } from '@nestjs/core';\nexport const start = (module: unknown) => NestFactory.createApplicationContext(module);\n"
const OWNER = "src/modules/domain/billing"
const ENTITY = "import { Entity, PrimaryColumn } from 'typeorm';\n@Entity('invoices')\nexport class InvoiceEntity { @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string }\n"
const MIGRATION = "import { MigrationInterface, QueryRunner } from 'typeorm';\nexport class CreateInvoices1789800000000 implements MigrationInterface {\n  name = 'CreateInvoices1789800000000';\n  async up(queryRunner: QueryRunner): Promise<void> { void queryRunner }\n  async down(queryRunner: QueryRunner): Promise<void> { void queryRunner }\n}\n"
const registration = (name) => [
    "import { Module } from '@nestjs/common';",
    "import { DatabaseModule } from '../../../src/modules/platform/database';",
    "import { billingEntities, billingMigrations } from '../../../src/modules/domain/billing';",
    "@Module({ imports: [DatabaseModule.register({ connections: [{ name: '" + name + "', entities: billingEntities, migrations: billingMigrations }] })] })",
    "export class AppModule {}",
    "",
].join("\n")
const SCHEMA_FILES = {
    "src/modules/platform/database/index.ts": "export { DatabaseModule } from './database.module';\n",
    "src/modules/platform/database/database.module.ts": "import { Module } from '@nestjs/common';\n@Module({})\nexport class DatabaseModule { static register(options: { connections: { name: string }[] }) { return { module: DatabaseModule, ...options } } }\n",
    [`${OWNER}/index.ts`]: "export { billingEntities, billingMigrations } from './persistence/connection';\n",
    [`${OWNER}/persistence/connection.ts`]: "import { InvoiceEntity } from './entities/invoice.entity';\nimport { CreateInvoices1789800000000 } from './migrations/1789800000000-create-invoices';\nexport const billingEntities = [InvoiceEntity];\nexport const billingMigrations = [CreateInvoices1789800000000];\n",
    [`${OWNER}/persistence/entities/invoice.entity.ts`]: ENTITY,
    [`${OWNER}/persistence/migrations/1789800000000-create-invoices.ts`]: MIGRATION,
    [APP]: registration("primary"),
    "apps/cli/src/main.ts": "void 0;\n",
    "apps/cli/src/app.module.ts": registration("primary"),
}
const schemaRepo = (t, edition, files = {}) => repo(t, {
    edition,
    apps: [{ name: "core", kind: "api" }, { name: "cli", kind: "cli" }],
    declaration: { connections: [{ name: "primary", envPrefix: "PRIMARY", owner: "core", isolation: "database" }] },
    files: { ...SCHEMA_FILES, ...files },
})

for (const edition of ["lite", "full"]) {
    test(`R32 accepts app composition and rejects business files in ${edition}`, (t) => {
        const fixture = repo(t, {
            edition,
            files: {
                [APP]: "export class AppModule {}\n",
                "apps/core/src/core.env.ts": "export const env = { port: 3000 };\n",
                "apps/core/src/core.options.ts": "export interface CoreOptions { readonly port: number }\n",
                "apps/core/src/pricing.ts": "export const price = (n: number) => n * 2;\n",
                "apps/core/src/leaky.service.ts": "export class LeakyService { run() { return 1 } }\n",
                "src/modules/domain/pricing/pricing.service.ts": "export class PricingService { run() { return 1 } }\n",
            },
        })
        fixture.tester.run("app-composition-only", rules["app-composition-only"], {
            valid: [source(fixture, MAIN), source(fixture, APP), source(fixture, "apps/core/src/core.env.ts"), source(fixture, "apps/core/src/core.options.ts"), source(fixture, "src/modules/domain/pricing/pricing.service.ts")],
            invalid: [
                invalid(fixture, "apps/core/src/pricing.ts", 1, /BE_APP_COMPOSITION_ONLY/),
                invalid(fixture, "apps/core/src/leaky.service.ts", 1, /BE_APP_BUSINESS_ROLE/),
            ],
        })
    })

    test(`R33 accepts app and TestWorld boot and rejects feature entrypoints in ${edition}`, (t) => {
        const fixture = repo(t, {
            edition,
            files: {
                [MAIN]: BOOT,
                "src/tests/world/use-test-world.ts": BOOT,
                "src/features/api/checkout/index.ts": BOOT,
                "src/features/api/checkout/bootstrap.ts": "declare function bootstrap(): Promise<void>;\nvoid bootstrap();\n",
            },
        })
        fixture.tester.run("entrypoint-only-in-apps", rules["entrypoint-only-in-apps"], {
            valid: [source(fixture, MAIN), source(fixture, "src/tests/world/use-test-world.ts")],
            invalid: [
                invalid(fixture, "src/features/api/checkout/index.ts", 2, /BE_ENTRYPOINT_ONLY_IN_APPS/),
                invalid(fixture, "src/features/api/checkout/bootstrap.ts", 2, /BE_ENTRYPOINT_ONLY_IN_APPS/),
            ],
        })
    })

    test(`R35 accepts owned schema and rejects misplaced entities and undeclared connections in ${edition}`, (t) => {
        const misplaced = "src/features/api/checkout/application/invoice.entity.ts"
        const correct = schemaRepo(t, edition, { [misplaced]: ENTITY })
        const unknown = schemaRepo(t, edition, { [APP]: registration("ledger"), "apps/cli/src/app.module.ts": registration("ledger") })
        correct.tester.run("schema-owner", rules["schema-owner"], {
            valid: [source(correct, APP), source(correct, `${OWNER}/index.ts`), source(correct, `${OWNER}/persistence/connection.ts`), source(correct, `${OWNER}/persistence/entities/invoice.entity.ts`), source(correct, `${OWNER}/persistence/migrations/1789800000000-create-invoices.ts`)],
            invalid: [
                invalid(correct, misplaced, 3, /BE_SCHEMA_OWNER.*Entity InvoiceEntity is declared outside/),
            ],
        })
        unknown.tester.run("schema-owner", rules["schema-owner"], {
            valid: [source(unknown, `${OWNER}/persistence/entities/invoice.entity.ts`)],
            invalid: [
                invalid(unknown, "apps/cli/src/app.module.ts", 4, /BE_SCHEMA_OWNER.*which hfs\.json does not declare/),
            ],
        })
    })
}
