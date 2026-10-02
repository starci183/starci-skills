/**
 * Twin tests for the query-safety rules (R36, R68, R69, R77).
 *
 *   node --test query-safety.spec.mjs
 *
 * Cases are virtual files under the typed fixture root: the slot comes from the path, `EntityManager` from the `typeorm`
 * stub, `SqlText`, `SqlIdent` and the `sql` tag from the fixture `platform/database/database.sql.ts`.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { noInterpolatedSql, noQueryBuilder, noQueryInLoop, queryNeedsLimit, rules, sqlTextOnly } from "./query-safety.mjs"
import { at, typedTester } from "./fixtures/typed/tester.mjs"

const tester = typedTester()

const HANDLER = at("src/features/api/checkout/application/place.handler.ts")
const HANDLER_SPEC = at("src/features/api/checkout/application/place.handler.spec.ts")
const SQL_FILE = at("src/modules/domain/order/persistence/order.sql.ts")
const ROWS_FILE = at("src/modules/domain/order/persistence/order.rows.ts")
const REPOSITORY_FILE = at("src/modules/domain/order/persistence/order.repository.ts")
const MIGRATION = at("src/modules/domain/order/persistence/migrations/1730000000000-create-orders.ts")

const HEAD = [
    'import { DataSource, EntityManager, QueryRunner } from "typeorm"',
    'import { ident, sql, type SqlIdent, type SqlText } from "@modules/platform/database/database.sql"',
    "declare class OrderEntity {}",
    "declare const manager: EntityManager",
    "declare const runner: QueryRunner",
    "declare const source: DataSource",
    "declare const FIND_ORDERS: SqlText",
    "declare const owner: string",
    "",
].join("\n")
const code = (body) => `${HEAD}${body}`

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("R36: `.query` takes a SqlText, and only a persistence <name>.sql.ts calls the sql tag", () => {
    tester.run("sql-text-only", sqlTextOnly, {
        valid: [
            { filename: HANDLER, code: code("await manager.query(FIND_ORDERS, [owner])") },
            { filename: HANDLER, code: code("await source.query(FIND_ORDERS)") },
            { filename: HANDLER_SPEC, code: code("await manager.query(FIND_ORDERS, [owner])") },
            // the tag is called in a persistence sql file
            { filename: SQL_FILE, code: code("export const FIND_OPEN = sql`SELECT id FROM orders WHERE owner = $1 LIMIT $2`") },
            // a migration is hand-written DDL run once
            { filename: MIGRATION, code: code("await runner.query('ALTER TABLE orders ADD COLUMN note text')") },
            // a `.query` that is not a database call
            { filename: HANDLER, code: "declare const client: { query(request: object): void }\nclient.query({ query: 'x' })" },
        ],
        invalid: [
            { filename: HANDLER, code: code("await manager.query('SELECT 1')"), errors: [{ messageId: "notSqlText" }] },
            { filename: HANDLER, code: code("await manager.query(`SELECT 1`)"), errors: [{ messageId: "notSqlText" }] },
            { filename: HANDLER, code: code("const text = 'SELECT 1'\nawait manager.query(text)"), errors: [{ messageId: "notSqlText" }] },
            { filename: HANDLER, code: code("await manager.query()"), errors: [{ messageId: "notSqlText" }] },
            { filename: HANDLER, code: code("await runner.query('SELECT 1')"), errors: [{ messageId: "notSqlText" }] },
            { filename: HANDLER, code: code("await source.query('SELECT 1')"), errors: [{ messageId: "notSqlText" }] },
            // a renamed receiver is still the manager
            { filename: HANDLER, code: code("const db = manager\nawait db.query('SELECT 1')"), errors: [{ messageId: "notSqlText" }] },
            // a look-alike brand declared next to the caller is not the platform's
            { filename: HANDLER, code: code("type SqlText = string\ndeclare const forged: SqlText\nawait manager.query(forged)"), errors: [{ messageId: "notSqlText" }] },
            // a spec is not exempt
            { filename: HANDLER_SPEC, code: code("await manager.query('SELECT 1')"), errors: [{ messageId: "notSqlText" }] },
            // a `*.repository.ts` is no home for SQL text: raw text and the tag are refused there exactly as in a handler
            { filename: REPOSITORY_FILE, code: code("await manager.query('SELECT 1')"), errors: [{ messageId: "notSqlText" }] },
            { filename: REPOSITORY_FILE, code: code("export const FIND_OPEN = sql`SELECT id FROM orders`"), errors: [{ messageId: "tagOutsideSqlFile" }] },
            // the tag outside a persistence sql file
            { filename: HANDLER, code: code("const text = sql`SELECT 1`"), errors: [{ messageId: "tagOutsideSqlFile" }] },
            { filename: ROWS_FILE, code: code("const text = sql`SELECT 1`"), errors: [{ messageId: "tagOutsideSqlFile" }] },
            { filename: HANDLER, code: code("const text = sql(['SELECT 1'] as unknown as TemplateStringsArray)"), errors: [{ messageId: "tagOutsideSqlFile" }] },
            // a renamed import is the same tag
            { filename: HANDLER, code: 'import { sql as q } from "@modules/platform/database/database.sql"\nconst text = q`SELECT 1`', errors: [{ messageId: "tagOutsideSqlFile" }] },
            { filename: HANDLER_SPEC, code: code("const text = sql`SELECT 1`"), errors: [{ messageId: "tagOutsideSqlFile" }] },
        ],
    })
})

test("R36: no query builder", () => {
    tester.run("no-query-builder", noQueryBuilder, {
        valid: [{ filename: HANDLER, code: code("await manager.find(OrderEntity, { take: 10 })") }],
        invalid: [
            { filename: HANDLER, code: code("manager.createQueryBuilder()"), errors: [{ messageId: "builder" }] },
            { filename: HANDLER, code: code("const builder = createQueryBuilder()"), errors: [{ messageId: "builder" }] },
            { filename: HANDLER_SPEC, code: code("manager.createQueryBuilder()"), errors: [{ messageId: "builder" }] },
        ],
    })
})

test("R68: a substitution in the sql tag is a SqlIdent; a .query string is never built", () => {
    tester.run("no-interpolated-sql", noInterpolatedSql, {
        valid: [
            { filename: SQL_FILE, code: code("export const A = sql`SELECT id FROM orders WHERE owner = $1`") },
            { filename: SQL_FILE, code: code("export const B = sql`SELECT ${ident('id', ['id'])} FROM orders`") },
            { filename: SQL_FILE, code: code("declare const column: SqlIdent\nexport const C = sql`SELECT ${column} FROM orders`") },
            { filename: HANDLER, code: code("await manager.query(FIND_ORDERS, [owner])") },
            // a template that is not a database call
            { filename: HANDLER, code: "declare const queue: { query(text: string): void }\ndeclare const name: string\nqueue.query(`hello ${name}`)" },
            // a migration is hand-written DDL run once
            { filename: MIGRATION, code: code("await runner.query(`ALTER TABLE ${owner} ADD COLUMN x int`)") },
        ],
        invalid: [
            { filename: SQL_FILE, code: code("export const A = sql`SELECT id FROM orders WHERE owner = '${owner}'`"), errors: [{ messageId: "substitution" }] },
            { filename: SQL_FILE, code: code("const name: string = 'id'\nexport const C = sql`SELECT ${name} FROM orders`"), errors: [{ messageId: "substitution" }] },
            { filename: SQL_FILE, code: code("declare const size: number\nexport const D = sql`SELECT id FROM orders LIMIT ${size}`"), errors: [{ messageId: "substitution" }] },
            // a renamed tag is the same tag
            { filename: SQL_FILE, code: 'import { sql as q } from "@modules/platform/database/database.sql"\ndeclare const name: string\nexport const E = q`SELECT ${name} FROM orders`', errors: [{ messageId: "substitution" }] },
            { filename: HANDLER, code: code("await manager.query(`SELECT id FROM orders WHERE owner = '${owner}'`)"), errors: [{ messageId: "built" }] },
            { filename: HANDLER, code: code("await manager.query('SELECT id FROM orders WHERE owner = ' + owner)"), errors: [{ messageId: "built" }] },
            { filename: HANDLER, code: code("const db = manager\nawait db.query(`SELECT ${owner}`)"), errors: [{ messageId: "built" }] },
            { filename: HANDLER_SPEC, code: code("await runner.query(`SELECT ${owner}`)"), errors: [{ messageId: "built" }] },
        ],
    })
})

test("R69: find, findBy and findAndCount on an EntityManager state take", () => {
    tester.run("query-needs-limit", queryNeedsLimit, {
        valid: [
            { filename: HANDLER, code: code("await manager.find(OrderEntity, { where: { owner }, take: 50 })") },
            { filename: HANDLER, code: code("await manager.findAndCount(OrderEntity, { take: 50, skip: 0 })") },
            // Array.prototype.find is not a query
            { filename: HANDLER, code: "declare const items: Array<{ id: string }>\nitems.find((item) => item.id === 'x')" },
            // a `find` on something that is not an EntityManager, whatever it is called
            { filename: HANDLER, code: "declare const manager: { find(options: object): void }\nmanager.find({ where: {} })" },
        ],
        invalid: [
            { filename: HANDLER, code: code("await manager.find(OrderEntity, { where: { owner } })"), errors: [{ messageId: "find" }] },
            { filename: HANDLER, code: code("await manager.find(OrderEntity)"), errors: [{ messageId: "find" }] },
            // a bound must be written where it can be read
            { filename: HANDLER, code: code("declare const options: object\nawait manager.find(OrderEntity, options)"), errors: [{ messageId: "find" }] },
            { filename: HANDLER, code: code("await manager.find(OrderEntity, { where: { owner }, ...{ take: 5 } })"), errors: [{ messageId: "find" }] },
            { filename: HANDLER, code: code("await manager.findAndCount(OrderEntity, { where: { owner } })"), errors: [{ messageId: "find" }] },
            { filename: HANDLER, code: code("await manager.findBy(OrderEntity, { owner })"), errors: [{ messageId: "findBy" }] },
            // a renamed receiver, and a spec, are the same rule
            { filename: HANDLER, code: code("const db = manager\nawait db.find(OrderEntity, { where: { owner } })"), errors: [{ messageId: "find" }] },
            { filename: HANDLER_SPEC, code: code("await manager.find(OrderEntity, { where: { owner } })"), errors: [{ messageId: "find" }] },
        ],
    })
})

test("R77: an EntityManager read does not run once per element of a loop", () => {
    tester.run("no-query-in-loop", noQueryInLoop, {
        valid: [
            // one read before the loop
            { filename: HANDLER, code: code("declare const ids: Array<string>\nconst rows = await manager.find(OrderEntity, { take: 50 })\nfor (const id of ids) { use(rows, id) }") },
            // a write per element is not this rule's business
            { filename: HANDLER, code: code("declare const plans: Array<object>\nfor (const plan of plans) { await manager.save(plan) }") },
            // a polling loop waits for state to change
            { filename: HANDLER, code: code("while (true) { const row = await manager.findOne(OrderEntity, { where: {} }); if (row) break }") },
            // a receiver that is not a manager, and Array.prototype.find
            { filename: HANDLER, code: "declare const ids: Array<string>\ndeclare const mailer: { find(id: string): void }\nfor (const id of ids) { mailer.find(id) }" },
            { filename: HANDLER, code: "declare const items: Array<{ id: string }>\ndeclare const lookup: Array<{ id: string }>\nitems.map((item) => lookup.find((entry) => entry.id === item.id))" },
        ],
        invalid: [
            { filename: HANDLER, code: code("declare const ids: Array<string>\nfor (const id of ids) { await manager.findOne(OrderEntity, { where: { id } }) }"), errors: [{ messageId: "inLoop" }] },
            { filename: HANDLER, code: code("declare const ids: Array<string>\nfor (let i = 0; i < ids.length; i += 1) { await manager.count(OrderEntity, { where: { owner: ids[i] } }) }"), errors: [{ messageId: "inLoop" }] },
            { filename: HANDLER, code: code("declare const ids: Array<string>\nawait Promise.all(ids.map((id) => manager.findOne(OrderEntity, { where: { id } })))"), errors: [{ messageId: "inLoop" }] },
            { filename: HANDLER, code: code("declare const ids: Array<string>\nids.forEach(async (id) => { await manager.find(OrderEntity, { where: { id }, take: 1 }) })"), errors: [{ messageId: "inLoop" }] },
            // a renamed receiver is the same manager
            { filename: HANDLER, code: code("declare const ids: Array<string>\nconst db = manager\nfor (const id of ids) { await db.findOne(OrderEntity, { where: { id } }) }"), errors: [{ messageId: "inLoop" }] },
            { filename: HANDLER_SPEC, code: code("declare const ids: Array<string>\nfor (const id of ids) { await manager.findOne(OrderEntity, { where: { id } }) }"), errors: [{ messageId: "inLoop" }] },
        ],
    })
})
