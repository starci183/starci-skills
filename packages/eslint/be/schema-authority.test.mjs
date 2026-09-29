import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noEntityInContract, noRuntimeSchema, sqlOnlyInRepository } from "./schema-authority.mjs"

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

test("raw SQL and query builders live in a persistence repository", () => {
    tester.run("sql-only-in-repository", sqlOnlyInRepository, {
        valid: [
            { filename: REPOSITORY, code: "await this.manager.query('SELECT 1')" },
            { filename: REPOSITORY, code: "this.repo.createQueryBuilder('p')" },
            { filename: MIGRATION, code: "await queryRunner.query('SELECT 1')" },
            // a GraphQL client query is not SQL: its argument is an options object
            { filename: SERVICE, code: "await client.query({ query: PlanDocument })" },
            { filename: SERVICE, code: "const found = await this.plans.findById(id)" },
        ],
        invalid: [
            { filename: SERVICE, code: "await this.manager.query('SELECT 1')", errors: [{ messageId: "sql" }] },
            { filename: SERVICE, code: "await this.manager.query(`SELECT ${column} FROM plan`)", errors: [{ messageId: "sql" }] },
            { filename: "D:/repo/src/features/plan/application/list.use-case.ts", code: "this.repo.createQueryBuilder('p')", errors: [{ messageId: "sql" }] },
            { filename: "D:/repo/src/modules/domain/plan/plan.repository.ts", code: "await this.manager.query('SELECT 1')", errors: [{ messageId: "sql" }] },
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
