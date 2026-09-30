import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { migrationDownReversible, noEntityInContract, noRuntimeSchema } from "./schema-authority.mjs"

const tester = typedTester()
const SERVICE = at("src/modules/domain/order/order.service.ts")
const SPEC = at("src/modules/domain/order/order.service.spec.ts")
const MIGRATION = at("src/modules/domain/order/persistence/migrations/1770000000000-create-order.ts")
const PERSISTED = at("src/modules/domain/order/persistence/order.sql.ts")
const TYPEORM = 'import { DataSource } from "typeorm"\nimport type { DataSourceOptions } from "typeorm"\nimport { TypeOrmModule } from "@nestjs/typeorm"\ndeclare const options: DataSourceOptions\ndeclare const dataSource: DataSource\n'

test("the schema is decided by migrations, never by the running process", () => {
    tester.run("no-runtime-schema", noRuntimeSchema, {
        valid: [
            { filename: SERVICE, code: `${TYPEORM}const ds = new DataSource({ type: "postgres", synchronize: false })` },
            { filename: SERVICE, code: `${TYPEORM}const module = TypeOrmModule.forRoot({ type: "postgres", synchronize: false })` },
            { filename: SERVICE, code: `${TYPEORM}const module = TypeOrmModule.forRootAsync({ useFactory: () => ({ type: "postgres", synchronize: false }) })` },
            { filename: SERVICE, code: "const options = { entities: [PlanEntity], migrations: [CreatePlan] }" },
            // DDL is written in migrations, whatever the case of the keywords
            { filename: MIGRATION, code: "await queryRunner.query('CREATE TABLE plan (id uuid primary key)')" },
            { filename: MIGRATION, code: "await queryRunner.query(`ALTER TABLE plan ADD COLUMN x int`)" },
            { filename: MIGRATION, code: "await queryRunner.query('create index plan_x on plan (x)')" },
            // reads and prose are not DDL
            { filename: SERVICE, code: "const sql = 'SELECT 1'\nconst note = 'create a table of contents'" },
        ],
        invalid: [
            // literal false is required in every options object
            { filename: SERVICE, code: `${TYPEORM}const ds = new DataSource({ type: "postgres" })`, errors: [{ messageId: "synchronizeMissing" }] },
            { filename: SERVICE, code: `${TYPEORM}const module = TypeOrmModule.forRoot({ type: "postgres" })`, errors: [{ messageId: "synchronizeMissing" }] },
            { filename: SERVICE, code: `${TYPEORM}const module = TypeOrmModule.forRootAsync({ useFactory: () => ({ type: "postgres" }) })`, errors: [{ messageId: "synchronizeMissing" }] },
            // a spread cannot state it
            { filename: SERVICE, code: `${TYPEORM}const ds = new DataSource({ ...options })`, errors: [{ messageId: "synchronizeMissing" }] },
            // options held elsewhere cannot be read
            { filename: SERVICE, code: `${TYPEORM}const ds = new DataSource(options)`, errors: [{ messageId: "optionsNotLiteral" }] },
            { filename: SERVICE, code: "const options = { synchronize: true }", errors: [{ messageId: "synchronize" }] },
            { filename: SERVICE, code: "const options = { synchronize: env.DB_SYNC === 'true' }", errors: [{ messageId: "synchronize" }] },
            { filename: SERVICE, code: "const synchronize = false; const o = { synchronize }", errors: [{ messageId: "synchronize" }] },
            { filename: SERVICE, code: `${TYPEORM}await dataSource.synchronize()`, errors: [{ messageId: "synchronizeCall" }] },
            // migrationsRun is banned in every form, false included
            { filename: SERVICE, code: "const options = { migrationsRun: true }", errors: [{ messageId: "migrationsRun" }] },
            { filename: SERVICE, code: "const options = { migrationsRun: false }", errors: [{ messageId: "migrationsRun" }] },
            // DDL outside migrations, in any string, in specs too
            { filename: SERVICE, code: "await manager.query('create table if not exists plan (id int)')", errors: [{ messageId: "ddl" }] },
            { filename: SERVICE, code: "await manager.query(`ALTER TABLE plan ADD COLUMN x int`)", errors: [{ messageId: "ddl" }] },
            { filename: SERVICE, code: "const sql = 'CREATE INDEX plan_x ON plan (x)'", errors: [{ messageId: "ddl" }] },
            { filename: SERVICE, code: "const sql = 'TRUNCATE TABLE plan'", errors: [{ messageId: "ddl" }] },
            { filename: PERSISTED, code: "await this.manager.query('DROP TABLE plan')", errors: [{ messageId: "ddl" }] },
            { filename: SPEC, code: "await manager.query('DROP TABLE plan')", errors: [{ messageId: "ddl" }] },
            { filename: at("src/tests/fixtures/database.ts"), code: "await manager.query('CREATE SCHEMA test')", errors: [{ messageId: "ddl" }] },
            // globs
            { filename: SERVICE, code: "const o = { entities: [__dirname + '/**/*.entity.ts'] }", errors: [{ messageId: "glob" }] },
            { filename: SERVICE, code: "const o = { migrations: ['dist/migrations/*.js'] }", errors: [{ messageId: "glob" }] },
        ],
    })
})

const ENTITY = 'import { OrderEntity } from "@modules/domain/order/persistence/entities/order.entity"\nimport type { OrderSummary } from "@modules/domain/order/order.contracts"\n'
const RESOLVER = at("src/features/checkout/transport/graphql/get-order.resolver.ts")
const RESPONSE = at("src/features/checkout/transport/http/dto/get-order.response.ts")
const CONTRACTS = at("src/modules/domain/invoice/invoice.contracts.ts")
const HANDLER = at("src/features/checkout/application/place.handler.ts")
const COMMAND = at("src/features/checkout/application/place.command.ts")
const ENTITY_FILE = at("src/modules/domain/invoice/persistence/entities/invoice.entity.ts")

test("an ORM entity never appears in a boundary type", () => {
    tester.run("no-entity-in-contract", noEntityInContract, {
        valid: [
            { filename: CONTRACTS, code: "export interface PlanSummary { id: string }" },
            { filename: CONTRACTS, code: `${ENTITY}export interface Page { items: Array<OrderSummary> }` },
            // an entity is fine inside the persistence layer and in a service's own signatures
            { filename: ENTITY_FILE, code: `${ENTITY}export class Other { owner!: OrderEntity }` },
            { filename: SERVICE, code: `${ENTITY}function load(): Promise<OrderEntity> { return Promise.resolve(new OrderEntity()) }` },
            // a handler's private helpers may hold entities; only execute is a boundary
            { filename: HANDLER, code: `${ENTITY}class H { async execute(params: { id: string }): Promise<OrderSummary> { return { id: params.id } }\n private load(): Promise<OrderEntity> { return Promise.resolve(new OrderEntity()) } }` },
            // a name ending in Entity is not an entity: the declaration decides
            { filename: CONTRACTS, code: "export interface UserEntity { id: string }\nexport interface Page { owner: UserEntity }" },
            { filename: ENTITY_FILE, code: 'import { Entity } from "typeorm"\n@Entity("x")\nexport class Row { id = "" }' },
        ],
        invalid: [
            { filename: CONTRACTS, code: `${ENTITY}export interface Plan { owner: OrderEntity }`, errors: [{ messageId: "entity" }] },
            // renamed at the import, still the declaration
            { filename: CONTRACTS, code: 'import { OrderEntity as Row } from "@modules/domain/order/persistence/entities/order.entity"\nexport interface Plan { owner: Row }', errors: [{ messageId: "entity" }] },
            // reached through type arguments and unions
            { filename: CONTRACTS, code: `${ENTITY}export interface Plan { owners: Array<OrderEntity> }`, errors: [{ messageId: "entity" }] },
            { filename: CONTRACTS, code: `${ENTITY}export type Found = OrderEntity | null`, errors: [{ messageId: "entity" }] },
            // reached through a property of a type the repository declares
            { filename: CONTRACTS, code: `${ENTITY}export interface Wrapper { row: OrderEntity }\nexport interface Plan { wrapped: Wrapper }`, errors: [{ messageId: "entity" }, { messageId: "entity" }] },
            { filename: RESOLVER, code: `${ENTITY}class R { get(): Promise<OrderEntity> { return Promise.resolve(new OrderEntity()) } }`, errors: [{ messageId: "entity" }] },
            { filename: RESOLVER, code: `${ENTITY}class R { get(id: string, row: OrderEntity): string { return id } }`, errors: [{ messageId: "entity" }] },
            { filename: RESPONSE, code: `${ENTITY}export class Res { order!: OrderEntity }`, errors: [{ messageId: "entity" }] },
            // the message carries the entity in its heritage
            { filename: COMMAND, code: `import { Command } from "@nestjs/cqrs"\n${ENTITY}export class PlaceCommand extends Command<OrderEntity> {}`, errors: [{ messageId: "entity" }] },
            // the handler's execute is the boundary
            { filename: HANDLER, code: `${ENTITY}class H { async execute(params: { id: string }): Promise<OrderEntity> { return new OrderEntity() } }`, errors: [{ messageId: "entity" }] },
            { filename: HANDLER, code: `${ENTITY}class H { async execute(params: OrderEntity): Promise<string> { return params.id } }`, errors: [{ messageId: "entity" }] },
            // entity files keep GraphQL and validators out
            { filename: ENTITY_FILE, code: 'import { Field } from "@nestjs/graphql"\nexport class Row {}', errors: [{ messageId: "entityImport" }] },
            { filename: ENTITY_FILE, code: 'import { IsString } from "class-validator"\nexport class Row {}', errors: [{ messageId: "entityImport" }] },
            // specs are not exempt
            { filename: at("src/features/checkout/transport/graphql/get-order.resolver.spec.ts"), code: `${ENTITY}class R { get(): Promise<OrderEntity> { return Promise.resolve(new OrderEntity()) } }`, errors: [{ messageId: "entity" }] },
        ],
    })
})

test("R74: a migration declares a down() that reverses its up()", () => {
    tester.run("migration-down-reversible", migrationDownReversible, {
        valid: [
            {
                filename: MIGRATION,
                code: "export class CreatePlan1 { async up(queryRunner) { await queryRunner.query('CREATE TABLE plan (id int)') } async down(queryRunner) { await queryRunner.query('DROP TABLE plan') } }",
            },
            // not a migration: no up()
            { filename: MIGRATION, code: "export class Helper { run() {} }" },
            // outside the migrations folder
            { filename: SERVICE, code: "export class Plan { async up() {} }" },
        ],
        invalid: [
            { filename: MIGRATION, code: "export class CreatePlan1 { async up(q) { await q.query('CREATE TABLE plan (id int)') } }", errors: [{ messageId: "missing" }] },
            { filename: MIGRATION, code: "export class CreatePlan1 { async up(q) { await q.query('x') } async down() {} }", errors: [{ messageId: "empty" }] },
            { filename: MIGRATION, code: "export class CreatePlan1 { async up(q) { await q.query('x') } async down() { throw new Error('irreversible') } }", errors: [{ messageId: "throws" }] },
        ],
    })
})
