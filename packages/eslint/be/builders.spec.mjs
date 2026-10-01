/**
 * Twin tests for the builder rules (R97 to R100, BE-TEST-16).
 *
 *   node --test builders.spec.mjs
 */
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { builderArrangesOnly, persistingBuilderInBuildersSlot, specNoRawInsert, specNoRepeatedRowLiteral, testsKeepConstraints } from "./builders.mjs"

const UNIT = at("src/modules/domain/order/order.service.spec.ts")
const E2E = at("src/tests/e2e/checkout/checkout.e2e-spec.ts")
const INTEGRATION = at("src/tests/integration/order/order.integration-spec.ts")
const BUILDER = at("src/tests/fixtures/builders/order.builder.ts")
const WORLD = at("src/tests/world/seed.ts")
const FIXTURES = at("src/tests/fixtures/order-seed.ts")
const IMPORT = "import { EntityManager, DataSource, QueryRunner } from 'typeorm'\n"
const ENTITY = "import { Entity } from 'typeorm'\n@Entity()\nclass Order { id!: number; status!: string }\n@Entity()\nclass Invoice { id!: number }\nclass Plain { id!: number }\n"
const RUNNER = "import { QueryRunner, EntityManager } from 'typeorm'\ndeclare const runner: QueryRunner\ndeclare const em: EntityManager\ndeclare const sql: (s: TemplateStringsArray) => string\n"
const tester = typedTester()

test("BE-TEST-16: a spec never runs a raw INSERT/UPDATE/DELETE or writes through an EntityManager, DataSource or QueryRunner", () => {
    tester.run("spec-no-raw-insert", specNoRawInsert, {
        valid: [
            // reads stay allowed: an e2e asserts persisted state
            { filename: E2E, code: `${IMPORT}declare const em: EntityManager\nclass Order {}\nit("x", async () => { await em.find(Order); await em.findOne(Order, {}); await em.count(Order); await em.query("SELECT 1") })` },
            { filename: E2E, code: `${IMPORT}declare const runner: QueryRunner\nit("x", async () => { await runner.query("select * from orders where id = $1", [1]) })` },
            // a builder call is the arrangement; the builder is not a database receiver
            { filename: E2E, code: `${IMPORT}declare const em: EntityManager\ndeclare const orderBuilder: (m: EntityManager) => { build(o: object): Promise<object> }\nit("x", async () => { await orderBuilder(em).build({}) })` },
            // asserting on a mock method is not a call of it
            { filename: UNIT, code: `${IMPORT}declare const em: EntityManager\ndeclare const expect: (x: unknown) => { toHaveBeenCalled(): void }\nit("x", () => { expect(em.save).toHaveBeenCalled() })` },
            // a value that is not a database receiver with a write-shaped name
            { filename: UNIT, code: 'declare const cache: { save(x: number): void; delete(k: string): void }\nit("x", () => { cache.save(1); cache.delete("k") })' },
            // the builder is not a spec: it may write
            { filename: BUILDER, code: `${IMPORT}declare const em: EntityManager\nexport const arrange = async (): Promise<unknown> => em.query("INSERT INTO orders (id) VALUES (1)")` },
        ],
        invalid: [
            { filename: E2E, code: `${IMPORT}declare const em: EntityManager\nit("x", async () => { await em.query("INSERT INTO orders (id) VALUES (1)") })`, errors: [{ messageId: "sql" }] },
            { filename: INTEGRATION, code: `${IMPORT}declare const source: DataSource\nit("x", async () => { await source.manager.query("update orders set status = 'paid'") })`, errors: [{ messageId: "sql" }] },
            { filename: UNIT, code: `${IMPORT}declare const runner: QueryRunner\nit("x", async () => { await runner.query(\`DELETE FROM orders\`) })`, errors: [{ messageId: "sql" }] },
            // a const holding the statement, and a template with a substitution
            { filename: E2E, code: `${IMPORT}declare const em: EntityManager\nconst sql = "insert into orders (id) values (1)"\nit("x", async () => { await em.query(sql) })`, errors: [{ messageId: "sql" }] },
            { filename: E2E, code: `${IMPORT}declare const em: EntityManager\ndeclare const table: string\nit("x", async () => { await em.query(\`INSERT INTO \${table} (id) VALUES (1)\`) })`, errors: [{ messageId: "sql" }] },
            // a tagged template holding the statement
            { filename: E2E, code: `${RUNNER}it("x", async () => { await em.query(sql\`INSERT INTO orders (id) VALUES (1)\`) })`, errors: [{ messageId: "sql" }] },
            // direct writes on each receiver type, whatever the variable is called
            { filename: E2E, code: `${IMPORT}declare const store: EntityManager\nit("x", async () => { await store.save({ id: 1 }) })`, errors: [{ messageId: "write" }] },
            { filename: INTEGRATION, code: `${IMPORT}declare const store: EntityManager\nclass Order {}\nit("x", async () => { await store.insert(Order, {}); await store.upsert(Order, {}, ["id"]); await store.update(Order, {}, {}); await store.delete(Order, {}); await store.remove({ id: 1 }) })`, errors: [{ messageId: "write" }, { messageId: "write" }, { messageId: "write" }, { messageId: "write" }, { messageId: "write" }] },
            { filename: E2E, code: `${IMPORT}declare const source: DataSource\nit("x", async () => { await source.manager.save({ id: 1 }) })`, errors: [{ messageId: "write" }] },
            // inside a transaction callback the manager parameter is typed
            { filename: E2E, code: `${IMPORT}declare const em: EntityManager\nit("x", async () => { await em.transaction(async (manager) => { await manager.save({ id: 1 }) }) })`, errors: [{ messageId: "write" }] },
        ],
    })
})

test("BE-TEST-16: a spec builds the same persistence entity as an object literal at most once", () => {
    tester.run("spec-no-repeated-row-literal", specNoRepeatedRowLiteral, {
        valid: [
            // one literal of an entity is fine; two different entities are fine
            { filename: E2E, code: `${ENTITY}const a: Order = { id: 1, status: "new" }\nconst b: Invoice = { id: 2 }\nexport { a, b }` },
            // a literal that derives from a builder result (spread) is an override, not a hand-built row
            { filename: E2E, code: `${ENTITY}declare const orderRow: () => Order\nconst a: Order = { ...orderRow(), status: "a" }\nconst b: Order = { ...orderRow(), status: "b" }\nexport { a, b }` },
            // repeated literals of a type that is not a persistence entity
            { filename: E2E, code: `${ENTITY}const a: Plain = { id: 1 }\nconst b: Plain = { id: 2 }\nexport { a, b }` },
            // an untyped literal has no entity type
            { filename: E2E, code: `${ENTITY}const a = { id: 1, status: "x" }\nconst b = { id: 2, status: "y" }\nexport { a, b }` },
            // the builder is not a spec
            { filename: BUILDER, code: `${ENTITY}export const a: Order = { id: 1, status: "new" }\nexport const b: Order = { id: 2, status: "old" }` },
        ],
        invalid: [
            { filename: E2E, code: `${ENTITY}const a: Order = { id: 1, status: "new" }\nconst b: Order = { id: 2, status: "old" }\nexport { a, b }`, errors: [{ messageId: "repeated" }] },
            { filename: UNIT, code: `${ENTITY}const rows: Array<Order> = [{ id: 1, status: "a" }, { id: 2, status: "b" }, { id: 3, status: "c" }]\nexport { rows }`, errors: [{ messageId: "repeated" }, { messageId: "repeated" }] },
            // a Partial of the entity is still that entity's row
            { filename: INTEGRATION, code: `${ENTITY}declare const make: (row: Partial<Order>) => void\nmake({ id: 1 })\nmake({ id: 2 })`, errors: [{ messageId: "repeated" }] },
        ],
    })
})

test("BE-TEST-16: a module of the test tree that creates persisted rows is a builder and lives in the builders slot", () => {
    tester.run("persisting-builder-in-builders-slot", persistingBuilderInBuildersSlot, {
        valid: [
            // the builders slot is the home
            { filename: BUILDER, code: `${IMPORT}export const orderBuilder = (em: EntityManager) => ({ build: async () => em.save({ id: 1 }) })` },
            // reads and a non-exported helper do not make a builder
            { filename: WORLD, code: `${IMPORT}export const countOrders = async (em: EntityManager) => em.query("SELECT count(*) FROM orders")` },
            { filename: FIXTURES, code: `${IMPORT}declare const em: EntityManager\nconst warm = async () => em.save({ id: 1 })\nwarm()\nexport const value = 1` },
            // a value with a write-shaped name that is not a database receiver
            { filename: WORLD, code: "declare const cache: { save(x: number): void }\nexport const remember = () => cache.save(1)" },
            // a spec is judged by the spec rules, not as a builder
            { filename: E2E, code: `${IMPORT}declare const em: EntityManager\nexport const arrange = async () => em.save({ id: 1 })` },
            // application code is not the test tree
            { filename: at("src/modules/domain/order/order.service.ts"), code: `${IMPORT}export const create = async (em: EntityManager) => em.save({ id: 1 })` },
        ],
        invalid: [
            { filename: FIXTURES, code: `${IMPORT}export const anOrder = async (em: EntityManager) => em.save({ id: 1 })`, errors: [{ messageId: "misplaced" }] },
            { filename: WORLD, code: `${IMPORT}export async function seedOrders(em: EntityManager) { await em.insert(Object, {}) }`, errors: [{ messageId: "misplaced" }] },
            { filename: FIXTURES, code: `${IMPORT}export const seed = async (em: EntityManager) => em.query("INSERT INTO orders (id) VALUES (1)")`, errors: [{ messageId: "misplaced" }] },
            // an exported function that reaches the write through a private helper
            { filename: FIXTURES, code: `${IMPORT}const write = async (em: EntityManager) => em.upsert(Object, {}, ["id"])\nexport const arrange = async (em: EntityManager) => write(em)`, errors: [{ messageId: "misplaced" }] },
            // exported through an export list
            { filename: WORLD, code: `${IMPORT}const seed = async (em: EntityManager) => em.save({ id: 1 })\nexport { seed }`, errors: [{ messageId: "misplaced" }] },
        ],
    })
})

test("BE-TEST-16: a builder arranges data only, with deterministic defaults", () => {
    tester.run("builder-arranges-only", builderArrangesOnly, {
        valid: [
            { filename: BUILDER, code: 'const CREATED_AT = new Date("2026-01-01T00:00:00.000Z")\nexport const commissionRow = (overrides = {}) => ({ id: "commission-1", createdAt: CREATED_AT, bps: 3000, ...overrides })' },
            { filename: BUILDER, code: "declare const ids: { next(): string }\nexport const accrueInput = (overrides = {}) => ({ orderId: ids.next(), ...overrides })" },
            // a local named like a framework global is not one
            { filename: BUILDER, code: "const test = (x: number) => x\nexport const value = test(1)" },
            { filename: BUILDER, code: "declare const seeded: { next(): number }\nexport const n = seeded.next()" },
            // not a builder: the rule has nothing to say
            { filename: UNIT, code: "it('x', () => { expect(1).toBe(1) })" },
            { filename: WORLD, code: "export const at = Date.now()" },
        ],
        invalid: [
            { filename: BUILDER, code: "export const arrange = (row: object) => { expect(row).toBeDefined(); return row }", errors: [{ messageId: "assertion" }] },
            { filename: BUILDER, code: 'import { expect } from "@jest/globals"\nexport const noop = 1', errors: [{ messageId: "assertion" }] },
            { filename: BUILDER, code: "export const stub = jest.fn()", errors: [{ messageId: "assertion" }] },
            { filename: BUILDER, code: "describe('x', () => {})", errors: [{ messageId: "assertion" }] },
            { filename: BUILDER, code: "export const at = Date.now()", errors: [{ messageId: "random" }] },
            { filename: BUILDER, code: "export const at = new Date()", errors: [{ messageId: "random" }] },
            { filename: BUILDER, code: "export const n = Math.random()", errors: [{ messageId: "random" }] },
            { filename: BUILDER, code: 'import { randomUUID } from "node:crypto"\nexport const id = randomUUID()', errors: [{ messageId: "random" }] },
            { filename: BUILDER, code: 'import crypto from "node:crypto"\nexport const id = crypto.randomUUID()\nexport const b = crypto.randomBytes(4)', errors: [{ messageId: "random" }, { messageId: "random" }] },
        ],
    })
})

test("BE-TEST-16: nothing in the test tree switches database constraints off", () => {
    tester.run("tests-keep-constraints", testsKeepConstraints, {
        valid: [
            { filename: BUILDER, code: `${RUNNER}export const ok = () => runner.query("INSERT INTO orders (id) VALUES (1)")` },
            { filename: E2E, code: `${RUNNER}it("x", async () => { await em.query("SELECT 1"); await runner.query("TRUNCATE orders CASCADE") })` },
            // the words in a test title are not SQL sent to a database
            { filename: E2E, code: 'it("never runs SET session_replication_role or DISABLE TRIGGER", () => {})' },
            // a non-database receiver and a file outside the test tree
            { filename: WORLD, code: 'declare const log: { query(s: string): void }\nlog.query("SET CONSTRAINTS ALL DEFERRED")' },
            { filename: at("src/modules/platform/database/tools.ts"), code: `${RUNNER}runner.query("SET session_replication_role = replica")` },
        ],
        invalid: [
            { filename: BUILDER, code: `${RUNNER}runner.query("SET session_replication_role = replica")`, errors: [{ messageId: "sql" }] },
            { filename: WORLD, code: `${RUNNER}em.query(\`ALTER TABLE orders DISABLE TRIGGER ALL\`)`, errors: [{ messageId: "sql" }] },
            { filename: E2E, code: `${RUNNER}it("x", async () => { await em.query("SET CONSTRAINTS ALL DEFERRED") })`, errors: [{ messageId: "sql" }] },
            { filename: INTEGRATION, code: `${RUNNER}const off = "ALTER TABLE orders DROP CONSTRAINT fk_orders_user"\nit("x", async () => { await runner.query(off) })`, errors: [{ messageId: "sql" }] },
            { filename: FIXTURES, code: `${RUNNER}runner.query("ALTER TABLE orders ADD CONSTRAINT fk FOREIGN KEY (a) REFERENCES b(id) DEFERRABLE INITIALLY DEFERRED")`, errors: [{ messageId: "sql" }] },
            // the SQL text file of the builders: a tagged template
            { filename: at("src/tests/fixtures/builders/order.sql.ts"), code: `${RUNNER}export const OFF = sql\`SET session_replication_role = replica\``, errors: [{ messageId: "sql" }] },
            { filename: WORLD, code: `${RUNNER}runner.dropForeignKey("orders", "fk_orders_user")`, errors: [{ messageId: "method" }] },
            { filename: E2E, code: `${RUNNER}it("x", async () => { await runner.dropCheckConstraint("orders", "chk"); await runner.dropUniqueConstraint("orders", "uq") })`, errors: [{ messageId: "method" }, { messageId: "method" }] },
        ],
    })
})
