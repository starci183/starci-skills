// proves: BE_TEST_ROW_BY_BUILDER@lite
// proves: BE_TEST_ROW_BY_BUILDER@full
import assert from "node:assert/strict"
import test from "node:test"
import { specNoRawInsert, specNoRepeatedRowLiteral } from "./builders.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"

const UNIT = at("src/modules/domain/order/order.service.spec.ts")
const INTEGRATION = at("src/tests/integration/order/order.integration-spec.ts")
const DB_IMPORT = "import { EntityManager, DataSource, QueryRunner } from 'typeorm'\n"
const ENTITY = `import { Entity } from "typeorm"
@Entity()
class Order { id!: number; status!: string }
class Plain { id!: number }
`

for (const edition of ["lite", "full"]) {
    test(`R99 accepts builder calls and reads and rejects direct database writes in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("spec-no-raw-insert", specNoRawInsert, {
            valid: [
                { filename: INTEGRATION, code: `${DB_IMPORT}declare const db: EntityManager\ndeclare const orderBuilder: (manager: EntityManager) => { build(): Promise<object> }\nasync function arrange() { await orderBuilder(db).build(); await db.query("SELECT * FROM orders") }` },
                { filename: UNIT, code: "declare const cache: { save(value: number): void }\ncache.save(1)" },
            ],
            invalid: [
                { filename: UNIT, code: `${DB_IMPORT}declare const db: EntityManager\ndb.save({ id: 1 })`, errors: [{ messageId: "write" }] },
                { filename: INTEGRATION, code: `${DB_IMPORT}declare const db: EntityManager\nclass Order {}\ndb.insert(Order, {}); db.upsert(Order, {}, ["id"]); db.update(Order, {}, {}); db.delete(Order, {}); db.remove({ id: 1 })`, errors: [{ messageId: "write" }, { messageId: "write" }, { messageId: "write" }, { messageId: "write" }, { messageId: "write" }] },
                { filename: INTEGRATION, code: `${DB_IMPORT}declare const source: DataSource\nsource.manager.save({ id: 1 })`, errors: [{ messageId: "write" }] },
                { filename: INTEGRATION, code: `${DB_IMPORT}declare const runner: QueryRunner\nrunner.query("INSERT INTO orders (id) VALUES (1)"); runner.query("UPDATE orders SET status = 'paid'"); runner.query("DELETE FROM orders")`, errors: [{ messageId: "sql" }, { messageId: "sql" }, { messageId: "sql" }] },
            ],
        })
    })

    test(`R99 accepts builder-derived rows and rejects repeated entity literals in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("spec-no-repeated-row-literal", specNoRepeatedRowLiteral, {
            valid: [
                { filename: INTEGRATION, code: `${ENTITY}declare const orderRow: () => Order\nconst first: Order = { ...orderRow(), status: "new" }\nconst second: Order = { ...orderRow(), status: "paid" }\nexport { first, second }` },
                { filename: UNIT, code: `${ENTITY}const first: Order = { id: 1, status: "new" }\nexport { first }` },
                { filename: UNIT, code: `${ENTITY}const first: Plain = { id: 1 }\nconst second: Plain = { id: 2 }\nexport { first, second }` },
            ],
            invalid: [
                { filename: INTEGRATION, code: `${ENTITY}const first: Order = { id: 1, status: "new" }\nconst second: Order = { id: 2, status: "paid" }\nexport { first, second }`, errors: [{ messageId: "repeated" }] },
                { filename: UNIT, code: `${ENTITY}declare const arrange: (row: Partial<Order>) => void\narrange({ id: 1 })\narrange({ id: 2 })`, errors: [{ messageId: "repeated" }] },
            ],
        })
    })
}
