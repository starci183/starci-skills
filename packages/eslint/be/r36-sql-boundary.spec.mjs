// proves: BE_SQL_OUTSIDE_PERSISTENCE@lite
// proves: BE_SQL_OUTSIDE_PERSISTENCE@full
import assert from "node:assert/strict"
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { rules } from "./query-safety.mjs"

const HANDLER = at("src/features/api/checkout/application/place.handler.ts")
const SQL_FILE = at("src/modules/domain/order/persistence/order.sql.ts")
const MIGRATION = at("src/modules/domain/order/persistence/migrations/1730000000000-create-orders.ts")
const HEAD = [
    'import { DataSource, EntityManager, QueryRunner } from "typeorm"',
    'import { sql, type SqlText } from "@modules/platform/database/database.sql"',
    "declare const manager: EntityManager",
    "declare const runner: QueryRunner",
    "declare const source: DataSource",
    "declare const FIND_ORDERS: SqlText",
    "",
].join("\n")
const sqlCase = (body) => HEAD + body

for (const edition of ["lite", "full"]) {
    test(`R36 sql-text-only accepts SqlText and rejects misplaced SQL in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("sql-text-only", rules["sql-text-only"], {
            valid: [
                { filename: HANDLER, code: sqlCase("await manager.query(FIND_ORDERS, [1])") },
                { filename: HANDLER, code: sqlCase("await source.query(FIND_ORDERS)") },
                { filename: SQL_FILE, code: sqlCase("export const FIND_OPEN = sql`SELECT id FROM orders LIMIT $1`") },
                { filename: MIGRATION, code: sqlCase("await runner.query('ALTER TABLE orders ADD COLUMN note text')") },
            ],
            invalid: [
                { filename: HANDLER, code: sqlCase("await manager.query('SELECT 1')"), errors: [{ messageId: "notSqlText" }] },
                { filename: HANDLER, code: sqlCase("await runner.query('SELECT 1')"), errors: [{ messageId: "notSqlText" }] },
                { filename: HANDLER, code: sqlCase("await source.query('SELECT 1')"), errors: [{ messageId: "notSqlText" }] },
                { filename: HANDLER, code: sqlCase("await manager.query()"), errors: [{ messageId: "notSqlText" }] },
                { filename: HANDLER, code: sqlCase("const find = sql`SELECT id FROM orders LIMIT $1`"), errors: [{ messageId: "tagOutsideSqlFile" }] },
            ],
        })
    })

    test(`R36 no-query-builder accepts SQL reads and rejects builders in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("no-query-builder", rules["no-query-builder"], {
            valid: [{ filename: HANDLER, code: sqlCase("await manager.query(FIND_ORDERS, [1])") }],
            invalid: [
                { filename: HANDLER, code: "manager.createQueryBuilder('orders')", errors: [{ messageId: "builder" }] },
                { filename: HANDLER, code: "createQueryBuilder('orders')", errors: [{ messageId: "builder" }] },
            ],
        })
    })
}
