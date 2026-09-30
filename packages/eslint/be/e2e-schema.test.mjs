/**
 * Twin tests for `e2e-no-schema-work` (R47, owner ruling 2026-09-30): an e2e spec never migrates or builds the schema.
 *
 *   node --test e2e-schema.test.mjs
 */
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { e2eNoSchemaWork } from "./e2e-flow.mjs"

const tester = typedTester()
const SPEC = at("src/tests/e2e/checkout/place-order.e2e-spec.ts")
const MIGRATE_SPEC = at("apps/migrate/src/migrate.composition.spec.ts")
const WORLD = at("src/tests/fixtures/e2e/database-world.ts")
const MIGRATION = '"../../../modules/domain/order/persistence/migrations/1700000000000-create-orders"'
const LIST = '"../../../modules/domain/order/order.migrations"'

test("R47: an e2e spec boots, calls and asserts; the schema is the globalSetup's", () => {
    tester.run("e2e-no-schema-work", e2eNoSchemaWork, {
        valid: [
            // a spec asserts through the fixture's EntityManager
            { filename: SPEC, code: 'import { EntityManager } from "typeorm"\ndeclare const manager: EntityManager\nexport const rows = manager.find(Object)' },
            // the migrate app's own specs test migrations
            { filename: MIGRATE_SPEC, code: `import { orderMigrations } from ${'"../../../src/modules/domain/order/order.migrations"'}\nexport const all = orderMigrations` },
            // the test bootstrap owns the container and the DataSource
            { filename: WORLD, code: 'import { PostgreSqlContainer } from "@testcontainers/postgresql"\nexport const db = new PostgreSqlContainer("postgres:16")' },
            // a method named like a schema call on a non-typeorm receiver
            { filename: SPEC, code: "declare const settings: { synchronize(): void }\nsettings.synchronize()" },
        ],
        invalid: [
            { filename: SPEC, code: `import { CreateOrders1700000000000 } from ${MIGRATION}\nexport const m = CreateOrders1700000000000`, errors: [{ messageId: "migration" }] },
            { filename: SPEC, code: `import { orderMigrations } from ${LIST}\nexport const m = orderMigrations`, errors: [{ messageId: "migration" }] },
            { filename: SPEC, code: 'import { migrate } from "../../../../apps/migrate/src/main"\nexport const run = migrate', errors: [{ messageId: "migration" }] },
            { filename: SPEC, code: 'import { DataSource } from "typeorm"\ndeclare const source: DataSource\nvoid source.runMigrations()', errors: [{ messageId: "call" }] },
            { filename: SPEC, code: 'import { DataSource } from "typeorm"\ndeclare const source: DataSource\nconst db = source\nvoid db.synchronize()', errors: [{ messageId: "call" }] },
            { filename: SPEC, code: 'import { PostgreSqlContainer } from "@testcontainers/postgresql"\nexport const db = new PostgreSqlContainer("postgres:16")', errors: [{ messageId: "container" }] },
        ],
    })
})
