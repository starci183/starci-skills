// proves: BE_TEST_CONSTRAINTS_ON@lite
// proves: BE_TEST_CONSTRAINTS_ON@full
// proves: BE_ERROR_CAUSE_DROPPED@lite
// proves: BE_ERROR_CAUSE_DROPPED@full
// proves: BE_MEMBER_DOC_MISSING@lite
// proves: BE_MEMBER_DOC_MISSING@full
import assert from "node:assert/strict"
import test from "node:test"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { testsKeepConstraints } from "./builders.mjs"
import { replacementThrowCarriesCause } from "./error-handling.mjs"
import { requirePublicMemberJsdoc } from "./comments.mjs"

const BUILDER = at("src/tests/fixtures/builders/order.builder.ts")
const SQL = at("src/tests/fixtures/builders/order.sql.ts")
const SERVICE = at("src/modules/domain/order/order.service.ts")
const RUNNER = "import type { QueryRunner } from 'typeorm'\ndeclare const runner: QueryRunner\n"
const ERROR = "declare function load(): void\ndeclare const pending: Promise<void>\ndeclare class OrderError extends Error { constructor(input: { code: string; cause?: unknown }) }\n"

for (const edition of ["lite", "full"]) {
    const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
    const tester = ruleTester({ root: TYPED_ROOT, hfs })

    test(`R100 accepts intact constraints and rejects disabled constraints in ${edition}`, () => {
        assert.equal(hfs.edition, edition)
        assert.equal(hfs.slotOf(BUILDER), "be.tests.fixtures.builders")
        tester.run("tests-keep-constraints", testsKeepConstraints, {
            valid: [
                { filename: BUILDER, code: RUNNER + 'runner.query("INSERT INTO orders (id) VALUES (1)")' },
                { filename: BUILDER, code: RUNNER + 'runner.query("SELECT id FROM orders")' },
                { filename: SQL, code: 'export const ROW = sql`SELECT id FROM orders`' },
                { filename: BUILDER, code: 'declare const log: { query(sql: string): void }; log.query("SET CONSTRAINTS ALL DEFERRED")' },
            ],
            invalid: [
                { filename: BUILDER, code: RUNNER + 'runner.query("SET session_replication_role = replica")', errors: [{ messageId: "sql" }] },
                { filename: BUILDER, code: RUNNER + 'runner.query("SET CONSTRAINTS ALL DEFERRED")', errors: [{ messageId: "sql" }] },
                { filename: BUILDER, code: RUNNER + 'runner.query("ALTER TABLE orders DISABLE TRIGGER ALL")', errors: [{ messageId: "sql" }] },
                { filename: BUILDER, code: RUNNER + 'runner.query("ALTER TABLE orders DROP CONSTRAINT fk_order_user")', errors: [{ messageId: "sql" }] },
                { filename: SQL, code: 'export const OFF = sql`SET CONSTRAINTS ALL DEFERRED`', errors: [{ messageId: "sql" }] },
                { filename: BUILDER, code: RUNNER + 'runner.dropForeignKey("orders", "fk_order_user")', errors: [{ messageId: "method" }] },
                { filename: BUILDER, code: RUNNER + 'runner.dropCheckConstraints("orders", [])', errors: [{ messageId: "method" }] },
                { filename: BUILDER, code: RUNNER + 'runner.dropUniqueConstraint("orders", "uq_order")', errors: [{ messageId: "method" }] },
            ],
        })
    })

    test(`R108 accepts preserved causes and rejects replacement throws that drop them in ${edition}`, () => {
        assert.equal(hfs.edition, edition)
        tester.run("replacement-throw-carries-cause", replacementThrowCarriesCause, {
            valid: [
                { filename: SERVICE, code: ERROR + "try { load() } catch (error) { throw error }" },
                { filename: SERVICE, code: ERROR + 'try { load() } catch (error) { throw new OrderError({ code: "ORDER_FAILED", cause: error }) }' },
                { filename: SERVICE, code: ERROR + 'pending.catch((error) => { throw new OrderError({ code: "ORDER_FAILED", cause: error }) })' },
                { filename: SERVICE, code: ERROR + 'try { load() } catch (error) { const next = new OrderError({ code: "ORDER_FAILED", cause: error }); throw next }' },
                { filename: SERVICE, code: ERROR + "try { load() } catch { return null }" },
            ],
            invalid: [
                { filename: SERVICE, code: ERROR + 'try { load() } catch (error) { throw new OrderError({ code: "ORDER_FAILED" }) }', errors: [{ messageId: "dropped" }] },
                { filename: SERVICE, code: ERROR + 'try { load() } catch { throw new OrderError({ code: "ORDER_FAILED" }) }', errors: [{ messageId: "unbound" }] },
                { filename: SERVICE, code: ERROR + 'pending.catch((error) => { throw new OrderError({ code: "ORDER_FAILED" }) })', errors: [{ messageId: "dropped" }] },
                { filename: SERVICE, code: ERROR + 'pending.catch(() => { throw new OrderError({ code: "ORDER_FAILED" }) })', errors: [{ messageId: "unbound" }] },
            ],
        })
    })

    test(`R109 accepts documented public members and rejects missing descriptions in ${edition}`, () => {
        assert.equal(hfs.edition, edition)
        tester.run("require-public-member-jsdoc", requirePublicMemberJsdoc, {
            valid: [
                { filename: SERVICE, code: "export class Orders {\n/** Returns orders visible to this caller. */\nread(): void {}\n}" },
                { filename: SERVICE, code: "export interface Order {\n/** The stable order identifier. */\nreadonly id: string\n}" },
                { filename: SERVICE, code: "export type Order = {\n/** The number of seats reserved by this order. */\nreadonly seats: number\n}" },
                { filename: SERVICE, code: "export class Orders { constructor(private readonly count: number) {} private load(): void {} protected cache = 1; #ready = true; readonly name = 'orders' }" },
                { filename: SERVICE, code: "export class Orders {\n/** Returns one order or every visible order. */\nread(id: string): string\nread(): string[]\nread(id?: string): string | string[] { return id ?? [] }\n}" },
            ],
            invalid: [
                { filename: SERVICE, code: "export class Orders { read(): void {} }", errors: [{ messageId: "jsdoc" }] },
                { filename: SERVICE, code: "export interface Order { readonly id: string }", errors: [{ messageId: "jsdoc" }] },
                { filename: SERVICE, code: "export type Order = { readonly seats: number }", errors: [{ messageId: "jsdoc" }] },
                { filename: SERVICE, code: "export class Orders {\n/** @returns Visible orders. */\nread(): void {}\n}", errors: [{ messageId: "jsdoc" }] },
                { filename: SERVICE, code: "export class Orders {\n// Returns visible orders.\nread(): void {}\n}", errors: [{ messageId: "jsdoc" }] },
            ],
        })
    })
}
