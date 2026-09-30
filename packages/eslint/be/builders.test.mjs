/**
 * Twin tests for the builder rules (R48, BE-TEST-16).
 *
 *   node --test builders.test.mjs
 */
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { builderArrangesOnly, specNoRawInsert } from "./builders.mjs"

const UNIT = at("src/modules/domain/order/order.service.spec.ts")
const E2E = at("src/tests/e2e/checkout/checkout.e2e-spec.ts")
const INTEGRATION = at("src/tests/integration/order/order.integration-spec.ts")
const BUILDER = at("src/tests/fixtures/builders/order.builder.ts")
const IMPORT = "import { EntityManager, DataSource, QueryRunner } from 'typeorm'\n"

test("BE-TEST-16: a spec never runs a raw INSERT/UPDATE/DELETE or writes through an EntityManager, DataSource or QueryRunner", () => {
    typedTester().run("spec-no-raw-insert", specNoRawInsert, {
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
            // direct writes on each receiver type, whatever the variable is called
            { filename: E2E, code: `${IMPORT}declare const store: EntityManager\nit("x", async () => { await store.save({ id: 1 }) })`, errors: [{ messageId: "write" }] },
            { filename: INTEGRATION, code: `${IMPORT}declare const store: EntityManager\nclass Order {}\nit("x", async () => { await store.insert(Order, {}); await store.upsert(Order, {}, ["id"]); await store.update(Order, {}, {}); await store.delete(Order, {}); await store.remove({ id: 1 }) })`, errors: [{ messageId: "write" }, { messageId: "write" }, { messageId: "write" }, { messageId: "write" }, { messageId: "write" }] },
            { filename: E2E, code: `${IMPORT}declare const source: DataSource\nit("x", async () => { await source.manager.save({ id: 1 }) })`, errors: [{ messageId: "write" }] },
            // inside a transaction callback the manager parameter is typed
            { filename: E2E, code: `${IMPORT}declare const em: EntityManager\nit("x", async () => { await em.transaction(async (manager) => { await manager.save({ id: 1 }) }) })`, errors: [{ messageId: "write" }] },
        ],
    })
})

const tester = new RuleTester({ languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" } })

test("BE-TEST-16: a builder arranges data only, with deterministic defaults and constraints on", () => {
    tester.run("builder-arranges-only", builderArrangesOnly, {
        valid: [
            { filename: BUILDER, code: 'const CREATED_AT = new Date("2026-01-01T00:00:00.000Z")\nexport const commissionRow = (overrides = {}) => ({ id: "commission-1", createdAt: CREATED_AT, bps: 3000, ...overrides })' },
            { filename: BUILDER, code: "declare const ids: { next(): string }\nexport const accrueInput = (overrides = {}) => ({ orderId: ids.next(), ...overrides })" },
            // a local named like a framework global is not one
            { filename: BUILDER, code: "const test = (x: number) => x\nexport const value = test(1)" },
            // constraint-safe SQL and a plain seeded prng
            { filename: BUILDER, code: 'export const sql = "INSERT INTO orders (id) VALUES ($1)"' },
            { filename: BUILDER, code: "declare const seeded: { next(): number }\nexport const n = seeded.next()" },
            // not a builder: the rule has nothing to say
            { filename: at("src/modules/domain/order/order.service.spec.ts"), code: "it('x', () => { expect(1).toBe(1) })" },
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
            { filename: BUILDER, code: 'export const off = "SET session_replication_role = replica"', errors: [{ messageId: "constraints" }] },
            { filename: BUILDER, code: "export const off = `ALTER TABLE orders DISABLE TRIGGER ALL`", errors: [{ messageId: "constraints" }] },
            { filename: BUILDER, code: 'export const off = "SET CONSTRAINTS ALL DEFERRED"', errors: [{ messageId: "constraints" }] },
            { filename: BUILDER, code: 'export const off = "ALTER TABLE orders DROP CONSTRAINT fk_orders_user"', errors: [{ messageId: "constraints" }] },
            { filename: BUILDER, code: 'export const off = "ALTER TABLE orders ADD CONSTRAINT fk FOREIGN KEY (a) REFERENCES b(id) DEFERRABLE"', errors: [{ messageId: "constraints" }] },
        ],
    })
})
