/**
 * Twin tests for the query-safety rules.
 *
 *   node --test query-safety.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noInterpolatedSql, queryNeedsLimit, rules } from "./query-safety.mjs"

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const REPOSITORY = "D:/repo/src/modules/domain/plan/persistence/plan.repository.ts"
const SPEC = "D:/repo/src/modules/domain/plan/persistence/plan.repository.spec.ts"
const MIGRATION = "D:/repo/src/modules/domain/plan/persistence/migrations/20260929120000-create-plan.ts"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("R68: a value reaches a statement as a parameter, never as spliced text", () => {
  tester.run("no-interpolated-sql", noInterpolatedSql, {
    valid: [
      { filename: REPOSITORY, code: "await manager.query('SELECT id FROM plan WHERE owner = $1', [owner])" },
      { filename: REPOSITORY, code: "await manager.query(`SELECT id FROM plan WHERE owner = $1`, [owner])" },
      // a module constant column list is code, not input
      { filename: REPOSITORY, code: "await manager.query(`SELECT ${PLAN_COLUMNS} FROM plan WHERE owner = $1`, [owner])" },
      // a numbered placeholder built from a count
      { filename: REPOSITORY, code: "await manager.query(`UPDATE plan SET x = 1 WHERE id = $${params.length + 1}`, params)" },
      // a quoted identifier and a checked SET list
      { filename: REPOSITORY, code: "await manager.query(`SELECT 1 FROM ${quoteIdent(table)} WHERE id = $1`, [id])" },
      { filename: REPOSITORY, code: "await manager.query(`UPDATE plan SET ${sqlSetClause(columns, ALLOWED)} WHERE id = $1`, [id])" },
      // a choice between fixed strings
      { filename: REPOSITORY, code: "await manager.query(`SELECT id FROM plan WHERE id = $1 ${locked ? 'FOR UPDATE' : ''}`, [id])" },
      // a template that is not SQL
      { filename: REPOSITORY, code: "await queue.query(`hello ${name}`)" },
      { filename: SPEC, code: "await manager.query(`SELECT * FROM ${table}`)" },
      { filename: MIGRATION, code: "await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN x int`)" },
    ],
    invalid: [
      { filename: REPOSITORY, code: "await manager.query(`SELECT id FROM plan WHERE owner = '${owner}'`)", errors: [{ messageId: "interpolated" }] },
      { filename: REPOSITORY, code: "await manager.query(`UPDATE plan SET ${sets.join(', ')} WHERE id = $1`, params)", errors: [{ messageId: "interpolated" }] },
      { filename: REPOSITORY, code: "await manager.query(`SELECT id FROM ${table} WHERE k = ${key}`)", errors: [{ messageId: "interpolated" }, { messageId: "interpolated" }] },
      { filename: REPOSITORY, code: "await manager.query('SELECT id FROM plan WHERE owner = ' + owner)", errors: [{ messageId: "concatenated" }] },
    ],
  })
})

test("R69: a list read states its bound", () => {
  tester.run("query-needs-limit", queryNeedsLimit, {
    valid: [
      { filename: REPOSITORY, code: "const rows = await qb.createQueryBuilder('p').where('p.owner = :o', { o }).take(50).getMany()" },
      { filename: REPOSITORY, code: "const rows = await this.repo.createQueryBuilder('p').limit(50).getRawMany()" },
      { filename: REPOSITORY, code: "const row = await this.repo.createQueryBuilder('p').where('p.id = :id', { id }).getOne()" },
      { filename: REPOSITORY, code: "const rows = await this.entityManager.find(PlanEntity, { where: { owner }, take: PAGE })" },
      { filename: REPOSITORY, code: "const rows = await this.planRepository.find({ where: { owner }, take: PAGE })" },
      // by primary key returns one row
      { filename: REPOSITORY, code: "const rows = await this.entityManager.find(PlanEntity, { where: { id } })" },
      { filename: REPOSITORY, code: "const rows = await this.entityManager.findBy(PlanEntity, { id })" },
      // Array.prototype.find is not a query
      { filename: REPOSITORY, code: "const hit = items.find((item) => item.id === id)" },
      { filename: REPOSITORY, code: "await manager.query('SELECT id FROM plan WHERE owner = $1 ORDER BY id LIMIT $2', [owner, PAGE])" },
      { filename: REPOSITORY, code: "await manager.query('SELECT COUNT(*) FROM plan WHERE owner = $1', [owner])" },
      { filename: REPOSITORY, code: "await manager.query('SELECT EXISTS (SELECT 1 FROM plan WHERE owner = $1)', [owner])" },
      { filename: REPOSITORY, code: "await manager.query('SELECT id FROM plan WHERE id = $1', [id])" },
      { filename: REPOSITORY, code: "await manager.query('UPDATE plan SET x = 1 WHERE owner = $1', [owner])" },
      { filename: SPEC, code: "await manager.query('SELECT id FROM plan')" },
    ],
    invalid: [
      { filename: REPOSITORY, code: "const rows = await qb.createQueryBuilder('p').where('p.owner = :o', { o }).getMany()", errors: [{ messageId: "builder" }] },
      { filename: REPOSITORY, code: "const rows = await this.repo.createQueryBuilder('p').select('p.id').getRawMany()", errors: [{ messageId: "builder" }] },
      { filename: REPOSITORY, code: "const rows = await this.entityManager.find(PlanEntity, { where: { owner } })", errors: [{ messageId: "find" }] },
      { filename: REPOSITORY, code: "const rows = await this.planRepository.find({ where: { owner } })", errors: [{ messageId: "find" }] },
      { filename: REPOSITORY, code: "const rows = await manager.findBy(PlanEntity, { owner })", errors: [{ messageId: "findBy" }] },
      { filename: REPOSITORY, code: "await manager.query('SELECT id FROM plan WHERE owner = $1', [owner])", errors: [{ messageId: "raw" }] },
      { filename: REPOSITORY, code: "await manager.query(`WITH x AS (SELECT 1) SELECT id FROM plan`)", errors: [{ messageId: "raw" }] },
    ],
  })
})
