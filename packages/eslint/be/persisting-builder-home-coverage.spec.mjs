// proves: BE_TEST_BUILDER_HOME@lite
// proves: BE_TEST_BUILDER_HOME@full
import assert from "node:assert/strict"
import test from "node:test"
import { persistingBuilderInBuildersSlot } from "./builders.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"

const BUILDER = at("src/tests/fixtures/builders/order.builder.ts")
const FIXTURES = at("src/tests/fixtures/order-seed.ts")
const WORLD = at("src/tests/world/seed.ts")
const DB_IMPORT = "import { EntityManager, QueryRunner } from 'typeorm'\n"
const PERSIST_ORDER = `${DB_IMPORT}export const orderBuilder = (db: EntityManager) => ({ build: async () => db.save({ id: 1 }) })`

for (const edition of ["lite", "full"]) {
    test(`R98 accepts persistent builders in their home and rejects misplaced exports in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        assert.equal(hfs.slotOf(BUILDER), "be.tests.fixtures.builders")
        ruleTester({ root: TYPED_ROOT, hfs }).run("persisting-builder-in-builders-slot", persistingBuilderInBuildersSlot, {
            valid: [
                { filename: BUILDER, code: PERSIST_ORDER },
                { filename: WORLD, code: `${DB_IMPORT}export const countOrders = (db: EntityManager) => db.query("SELECT count(*) FROM orders")` },
                { filename: FIXTURES, code: `${DB_IMPORT}declare const db: EntityManager\nconst warm = () => db.save({ id: 1 })\nwarm()\nexport const fixtureId = 1` },
                { filename: WORLD, code: "declare const cache: { save(value: number): void }\nexport const remember = () => cache.save(1)" },
            ],
            invalid: [
                { filename: FIXTURES, code: PERSIST_ORDER, errors: [{ messageId: "misplaced" }] },
                { filename: WORLD, code: `${DB_IMPORT}export const seedOrders = (runner: QueryRunner) => runner.query("INSERT INTO orders (id) VALUES (1)")`, errors: [{ messageId: "misplaced" }] },
                { filename: FIXTURES, code: `${DB_IMPORT}const write = (db: EntityManager) => db.upsert(Object, {}, ["id"])\nexport const arrange = (db: EntityManager) => write(db)`, errors: [{ messageId: "misplaced" }] },
                { filename: WORLD, code: `${DB_IMPORT}const seed = (db: EntityManager) => db.save({ id: 1 })\nexport { seed }`, errors: [{ messageId: "misplaced" }] },
            ],
        })
    })
}
