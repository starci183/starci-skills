// proves: BE_SCHEMA_AUTHORITY@lite
// proves: BE_SCHEMA_AUTHORITY@full
import assert from "node:assert/strict"
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { noRuntimeSchema } from "./schema-authority.mjs"

const SERVICE = at("src/modules/domain/order/order.service.ts")
const MIGRATION = at("src/modules/domain/order/persistence/migrations/1770000000000-create-order.ts")
const CLI = at("src/features/cli/migrate/subs/run.cli.ts")
const TYPEORM = 'import { DataSource } from "typeorm"\ndeclare const dataSource: DataSource\n'

for (const edition of ["lite", "full"]) {
    test(`R34 keeps schema changes in migrations in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("no-runtime-schema", noRuntimeSchema, {
            valid: [
                { filename: SERVICE, code: `${TYPEORM}const source = new DataSource({ type: "postgres", synchronize: false })` },
                { filename: MIGRATION, code: "await queryRunner.query('CREATE TABLE orders (id uuid primary key)')" },
                { filename: CLI, code: `${TYPEORM}await dataSource.runMigrations()` },
                { filename: SERVICE, code: "const sql = 'SELECT id FROM orders'" },
            ],
            invalid: [
                { filename: SERVICE, code: `${TYPEORM}const source = new DataSource({ type: "postgres", synchronize: true })`, errors: [{ messageId: "synchronize" }] },
                { filename: SERVICE, code: `${TYPEORM}const source = new DataSource({ type: "postgres" })`, errors: [{ messageId: "synchronizeMissing" }] },
                { filename: SERVICE, code: `${TYPEORM}await dataSource.synchronize()`, errors: [{ messageId: "synchronizeCall" }] },
                { filename: SERVICE, code: `${TYPEORM}await dataSource.runMigrations()`, errors: [{ messageId: "runMigrations" }] },
                { filename: SERVICE, code: "await manager.query('CREATE TABLE orders (id uuid primary key)')", errors: [{ messageId: "ddl" }] },
                { filename: SERVICE, code: "const options = { migrationsRun: false }", errors: [{ messageId: "migrationsRun" }] },
            ],
        })
    })
}
