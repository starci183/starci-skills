import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { migrationDownReversible, noEntityInContract, noRuntimeSchema } from "./schema-authority.mjs"

const tester = typedTester()
const SERVICE = at("src/modules/domain/order/order.service.ts")
const SPEC = at("src/modules/domain/order/order.service.spec.ts")
const MIGRATION = at("src/modules/domain/order/persistence/migrations/1770000000000-create-order.ts")
const EM = 'import type { EntityManager } from "typeorm"\n'
const MIGRATE_APP = at("src/features/cli/migrate/subs/run.cli.ts")
const WORLD_SETUP = at("src/tests/world/global-setup.ts")
const PERSISTED = at("src/modules/domain/order/persistence/order.sql.ts")
const TYPEORM = 'import { DataSource } from "typeorm"\nimport type { DataSourceOptions } from "typeorm"\nimport { TypeOrmModule } from "@nestjs/typeorm"\ndeclare const options: DataSourceOptions\ndeclare const dataSource: DataSource\n'

test("the schema is decided by migrations, never by the running process", () => {
    tester.run("no-runtime-schema", noRuntimeSchema, {
        valid: [
            { filename: SERVICE, code: `${TYPEORM}const ds = new DataSource({ type: "postgres", synchronize: false })` },
            { filename: SERVICE, code: `${TYPEORM}const module = TypeOrmModule.forRoot({ type: "postgres", synchronize: false })` },
            { filename: SERVICE, code: `${TYPEORM}const module = TypeOrmModule.forRootAsync({ useFactory: () => ({ type: "postgres", synchronize: false }) })` },
            { filename: SERVICE, code: "const options = { entities: [PlanEntity], migrations: [CreatePlan] }" },
            // a typed double of a DataSource overrides operations by key: `synchronize` there is a method, not the config flag
            { filename: SERVICE, code: `${TYPEORM}declare function mock<T>(overrides?: Partial<T>): T
const ds = mock<DataSource>({ manager: undefined, synchronize: undefined, dropDatabase: undefined })` },
            { filename: SERVICE, code: `${TYPEORM}declare function mock<T>(overrides?: Partial<T>): T
const ds = mock<DataSource>({ manager: undefined })` },
            // migrations run in the cli (its migrate command) and in the test world
            { filename: MIGRATE_APP, code: `${TYPEORM}await dataSource.runMigrations()` },
            { filename: WORLD_SETUP, code: `${TYPEORM}await dataSource.runMigrations()` },
            // entity options without the switch, dropSchema stated false, a schema read
            { filename: SERVICE, code: `import { Entity } from "typeorm"\n@Entity({ name: "plan" })\nexport class PlanEntity {}\n@Entity("plan_item")\nexport class PlanItemEntity {}` },
            { filename: SERVICE, code: `${TYPEORM}const ds = new DataSource({ type: "postgres", synchronize: false, dropSchema: false })` },
            // a lifecycle hook that only reads, and one that writes inside the cli (a seed command)
            { filename: SERVICE, code: `${TYPEORM}${EM}export class Probe { constructor(private readonly manager: EntityManager) {} async onModuleInit(): Promise<void> { await this.manager.query("SELECT 1"); await this.manager.find(class A {}) } }` },
            { filename: MIGRATE_APP, code: `${TYPEORM}${EM}export class Seeder { constructor(private readonly manager: EntityManager) {} async onModuleInit(): Promise<void> { await this.manager.save({}) } }` },
            // a write outside a lifecycle hook is a handler's business, and a save on a value that is not typeorm's manager is not a row write
            { filename: SERVICE, code: `${TYPEORM}${EM}export class Svc { constructor(private readonly manager: EntityManager) {} async place(): Promise<void> { await this.manager.save({}) } }` },
            { filename: SERVICE, code: `export class Store { save(): void {} }\nexport class Boot { constructor(private readonly store: Store) {} onModuleInit(): void { this.store.save() } }` },
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
            { filename: SERVICE, code: `${TYPEORM}await dataSource.dropDatabase()`, errors: [{ messageId: "synchronizeCall" }] },
            // a typed options object stays refused when it turns synchronize on, and a DataSource double is only exempt by its contextual type
            { filename: SERVICE, code: `${TYPEORM}declare const options: DataSourceOptions
const o: DataSourceOptions = { type: "postgres", synchronize: true }`, errors: [{ messageId: "synchronize" }] },
            // migrations run in the cli only
            { filename: SERVICE, code: `${TYPEORM}await dataSource.runMigrations()`, errors: [{ messageId: "runMigrations" }] },
            { filename: SERVICE, code: `${TYPEORM}await dataSource.undoLastMigration()`, errors: [{ messageId: "runMigrations" }] },
            { filename: SPEC, code: `${TYPEORM}await dataSource.runMigrations()`, errors: [{ messageId: "runMigrations" }] },
            // dropSchema is refused unless it is the literal false
            { filename: SERVICE, code: `${TYPEORM}const ds = new DataSource({ type: "postgres", synchronize: false, dropSchema: true })`, errors: [{ messageId: "dropSchema" }] },
            { filename: SERVICE, code: `${TYPEORM}const module = TypeOrmModule.forRoot({ type: "postgres", synchronize: false, dropSchema: process.env.DROP === "1" })`, errors: [{ messageId: "dropSchema" }] },
            // a schema builder builds the schema from metadata at runtime, resolved by its type
            { filename: SERVICE, code: `${TYPEORM}const builder = dataSource.createSchemaBuilder()\nawait builder.build()`, errors: [{ messageId: "schemaBuilder" }, { messageId: "schemaBuilder" }] },
            { filename: SERVICE, code: `${TYPEORM}import type { SchemaBuilder } from "typeorm"\ndeclare const other: SchemaBuilder\nawait other.log()`, errors: [{ messageId: "schemaBuilder" }] },
            // a per-entity synchronize switch, on or off, is a second authority
            { filename: SERVICE, code: `import { Entity } from "typeorm"\n@Entity({ name: "plan", synchronize: false })\nexport class PlanEntity {}`, errors: [{ messageId: "entitySynchronize" }] },
            { filename: SERVICE, code: `import { Entity } from "typeorm"\n@Entity({ synchronize: true })\nexport class PlanEntity {}`, errors: [{ messageId: "entitySynchronize" }] },
            // a lifecycle hook that writes rows seeds at boot: directly, through a method of the class, through a transaction, through INSERT text
            { filename: SERVICE, code: `${TYPEORM}${EM}export class Seed { constructor(private readonly manager: EntityManager) {} async onModuleInit(): Promise<void> { await this.manager.save({}) } }`, errors: [{ messageId: "bootSeed" }] },
            { filename: SERVICE, code: `${TYPEORM}${EM}export class Seed { constructor(private readonly manager: EntityManager) {} async onApplicationBootstrap(): Promise<void> { await this.load() } private async load(): Promise<void> { await this.manager.insert(class A {}, {}) } }`, errors: [{ messageId: "bootSeed" }] },
            { filename: SERVICE, code: `${TYPEORM}export class Seed { constructor(private readonly ds: DataSource) {} async onModuleInit(): Promise<void> { await this.ds.transaction(async (tx) => { await tx.upsert(class A {}, {}, ["id"]) }) } }`, errors: [{ messageId: "bootSeed" }] },
            { filename: SERVICE, code: `${TYPEORM}${EM}export class Seed { constructor(private readonly manager: EntityManager) {} async onModuleInit(): Promise<void> { await this.manager.query("INSERT INTO plan (id) VALUES (1)") } }`, errors: [{ messageId: "bootSeed" }] },
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
            // DDL beyond tables, in any SQL text outside a migration
            { filename: SERVICE, code: "await manager.query('CREATE SCHEMA IF NOT EXISTS audit')", errors: [{ messageId: "ddl" }] },
            { filename: SERVICE, code: "await manager.query(`ALTER TYPE plan_kind ADD VALUE 'gold'`)", errors: [{ messageId: "ddl" }] },
            { filename: SERVICE, code: "await manager.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')", errors: [{ messageId: "ddl" }] },
            { filename: SERVICE, code: "const s = 'DROP INDEX plan_x'", errors: [{ messageId: "ddl" }] },
            { filename: SERVICE, code: "const s = 'CREATE TRIGGER t BEFORE UPDATE ON plan FOR EACH ROW EXECUTE FUNCTION f()'", errors: [{ messageId: "ddl" }] },
            { filename: SERVICE, code: "const s = 'CREATE OR REPLACE FUNCTION f() RETURNS trigger AS $$ BEGIN RETURN NEW; END $$ LANGUAGE plpgsql'", errors: [{ messageId: "ddl" }] },
            { filename: SERVICE, code: "const s = 'ALTER TABLE plan ADD CONSTRAINT plan_x UNIQUE (x)'", errors: [{ messageId: "ddl" }] },
            { filename: SERVICE, code: "const s = 'ALTER TABLE plan DROP CONSTRAINT plan_x'", errors: [{ messageId: "ddl" }] },
            // globs
            { filename: SERVICE, code: "const o = { entities: [__dirname + '/**/*.entity.ts'] }", errors: [{ messageId: "glob" }] },
            { filename: SERVICE, code: "const o = { migrations: ['dist/migrations/*.js'] }", errors: [{ messageId: "glob" }] },
        ],
    })
})

const ENTITY = 'import { OrderEntity } from "@modules/domain/order/persistence/entities/order.entity"\nimport type { OrderSummary } from "@modules/domain/order/order.contracts"\n'
const RESOLVER = at("src/features/api/checkout/transport/graphql/get-order.resolver.ts")
const RESPONSE = at("src/features/api/checkout/transport/http/dto/get-order.response.ts")
const CONTRACTS = at("src/modules/domain/invoice/invoice.contracts.ts")
const HANDLER = at("src/features/api/checkout/application/place.handler.ts")
const COMMAND = at("src/features/api/checkout/application/place.command.ts")
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
            { filename: at("src/features/api/checkout/transport/graphql/get-order.resolver.spec.ts"), code: `${ENTITY}class R { get(): Promise<OrderEntity> { return Promise.resolve(new OrderEntity()) } }`, errors: [{ messageId: "entity" }] },
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
