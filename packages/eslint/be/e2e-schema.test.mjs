/**
 * Twin tests for `e2e-no-schema-work` (R47, owner ruling 2026-09-30): ONE e2e world owns the infrastructure; a spec only
 * uses `useE2eWorld({ app })`.
 *
 *   node --test e2e-schema.test.mjs
 */
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { e2eNoSchemaWork } from "./e2e-flow.mjs"

const tester = typedTester()
const SPEC = at("src/tests/e2e/checkout/place-order.e2e-spec.ts")
const MIGRATE_SPEC = at("apps/migrate/src/migrate.composition.spec.ts")
const WORLD = at("src/tests/e2e/world/global-setup.ts")
const MIGRATION = '"../../../modules/domain/order/persistence/migrations/1700000000000-create-orders"'
const LIST = '"../../../modules/domain/order/order.migrations"'
const MANAGER = 'import type { EntityManager } from "typeorm"\n'

test("R47: an e2e spec boots, calls and asserts; infrastructure and schema are the e2e world's", () => {
    tester.run("e2e-no-schema-work", e2eNoSchemaWork, {
        valid: [
            // a spec asserts through the world's EntityManager
            { filename: SPEC, code: `${MANAGER}declare const world: { db: { primary: EntityManager } }\nexport const rows = world.db.primary.find(Object)` },
            // the migrate app's own specs test migrations
            { filename: MIGRATE_SPEC, code: `import { orderMigrations } from ${'"../../../src/modules/domain/order/order.migrations"'}\nexport const all = orderMigrations` },
            // the e2e world starts the container, holds the DataSource, migrates and sets the environment
            { filename: WORLD, code: 'import { PostgreSqlContainer } from "@testcontainers/postgresql"\nimport { DataSource } from "typeorm"\nexport const db = new PostgreSqlContainer("postgres:16")\ndeclare const source: DataSource\nvoid source.runMigrations()\nprocess.env.PRIMARY_DB_HOST = "localhost"' },
            // a method named like a schema call on a non-typeorm receiver, and reading the environment
            { filename: SPEC, code: "declare const settings: { synchronize(): void }\nsettings.synchronize()\nexport const port = process.env.PORT" },
        ],
        invalid: [
            { filename: SPEC, code: `import { CreateOrders1700000000000 } from ${MIGRATION}\nexport const m = CreateOrders1700000000000`, errors: [{ messageId: "migration" }] },
            { filename: SPEC, code: `import { orderMigrations } from ${LIST}\nexport const m = orderMigrations`, errors: [{ messageId: "migration" }] },
            { filename: SPEC, code: 'import { migrate } from "../../../../apps/migrate/src/main"\nexport const run = migrate', errors: [{ messageId: "migration" }] },
            { filename: SPEC, code: 'import { DataSource } from "typeorm"\nexport type S = DataSource', errors: [{ messageId: "container" }] },
            { filename: SPEC, code: `${MANAGER}declare const manager: EntityManager\nconst db = manager\nvoid db.synchronize()`, errors: [{ messageId: "call" }] },
            { filename: SPEC, code: 'import { PostgreSqlContainer } from "@testcontainers/postgresql"\nexport const db = new PostgreSqlContainer("postgres:16")', errors: [{ messageId: "container" }, { messageId: "container" }] },
            { filename: SPEC, code: 'process.env.PRIMARY_DB_HOST = "x"', errors: [{ messageId: "env" }] },
            { filename: SPEC, code: 'delete process.env["PRIMARY_DB_HOST"]', errors: [{ messageId: "env" }] },
            { filename: SPEC, code: 'Object.assign(process.env, { A: "1" })', errors: [{ messageId: "env" }] },
        ],
    })
})
