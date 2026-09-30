import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { migrationDownReversible, noEntityInContract, noRuntimeSchema } from "./schema-authority.mjs"

const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const SERVICE = "D:/repo/src/modules/domain/plan/plan.service.ts"
const MIGRATION = "D:/repo/src/modules/domain/plan/persistence/migrations/20260929120000-create-plan.ts"
const REPOSITORY = "D:/repo/src/modules/domain/plan/persistence/plan.repository.ts"

test("the schema is decided by migrations, never by the running process", () => {
    tester.run("no-runtime-schema", noRuntimeSchema, {
        valid: [
            { filename: SERVICE, code: "const options = { synchronize: false, migrationsRun: false }" },
            { filename: SERVICE, code: "const options = { entities: [PlanEntity], migrations: [CreatePlan] }" },
            { filename: MIGRATION, code: "await queryRunner.query('CREATE TABLE plan (id uuid primary key)')" },
            { filename: MIGRATION, code: "await queryRunner.query(`ALTER TABLE plan ADD COLUMN x int`)" },
            { filename: SERVICE, code: "const sql = 'SELECT 1'" },
        ],
        invalid: [
            { filename: SERVICE, code: "const options = { synchronize: true }", errors: [{ messageId: "synchronize" }] },
            { filename: SERVICE, code: "const options = { synchronize: env.DB_SYNC === 'true' }", errors: [{ messageId: "synchronize" }] },
            { filename: SERVICE, code: "const synchronize = false; const o = { synchronize }", errors: [{ messageId: "synchronize" }] },
            { filename: SERVICE, code: "await dataSource.synchronize()", errors: [{ messageId: "synchronizeCall" }] },
            { filename: SERVICE, code: "const options = { migrationsRun: true }", errors: [{ messageId: "migrationsRun" }] },
            { filename: SERVICE, code: "const options = { migrationsRun: options.run }", errors: [{ messageId: "migrationsRun" }] },
            { filename: SERVICE, code: "await manager.query('create table if not exists plan (id int)')", errors: [{ messageId: "ddl" }] },
            { filename: SERVICE, code: "await manager.query(`ALTER TABLE plan ADD COLUMN x int`)", errors: [{ messageId: "ddl" }] },
            { filename: REPOSITORY, code: "await this.manager.query('DROP TABLE plan')", errors: [{ messageId: "ddl" }] },
            { filename: SERVICE, code: "const o = { entities: [__dirname + '/**/*.entity.ts'] }", errors: [{ messageId: "glob" }] },
            { filename: SERVICE, code: "const o = { migrations: ['dist/migrations/*.js'] }", errors: [{ messageId: "glob" }] },
        ],
    })
})

test("an ORM entity never appears in a boundary type", () => {
    tester.run("no-entity-in-contract", noEntityInContract, {
        valid: [
            { filename: "D:/repo/src/modules/domain/plan/plan.contracts.ts", code: "export interface PlanSummary { id: string }" },
            { filename: "D:/repo/src/modules/domain/plan/persistence/entities/plan.entity.ts", code: "export class PlanEntity { owner: UserEntity }" },
            { filename: SERVICE, code: "function load(): PlanEntity {}" },
        ],
        invalid: [
            { filename: "D:/repo/src/modules/domain/plan/plan.contracts.ts", code: "export interface Plan { owner: UserEntity }", errors: [{ messageId: "entity" }] },
            { filename: "D:/repo/src/features/plan/transport/graphql/get-plan.resolver.ts", code: "class R { get(): Promise<PlanEntity> {} }", errors: [{ messageId: "entity" }] },
            { filename: "D:/repo/src/features/plan/transport/http/dto/get-plan.response.ts", code: "export class Res { plan: PlanEntity }", errors: [{ messageId: "entity" }] },
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
