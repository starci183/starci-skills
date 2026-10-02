/**
 * Twin tests for the projection laws (R161 `BE_PROJECTION_WRITE_OWNER`, R162 `BE_PROJECTION_SHAPE`).
 *
 *   node --test projections.spec.mjs
 *
 * The fixture project declares the user-xp projection (`projections/userxp`) with its entity and class; a case's path decides its
 * slot, tier and kind.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, BE_DECLARATION, typedTester } from "./fixtures/typed/tester.mjs"
import { projectionShape, projectionWriteOwner, rules } from "./projections.mjs"

const tester = typedTester({ declaration: { ...BE_DECLARATION, patterns: ["projection", "event-bus", "fenced-job"] } })

const PROJECTION = at("src/modules/projections/userxp/scratch.projection.ts")
const PROJECTION_INDEX = at("src/modules/projections/scratch/index.ts")
const CONTRACTS = at("src/modules/projections/userxp/user-xp.contracts.ts")
const OTHER_PROJECTION = at("src/modules/projections/other/other.projection.ts")
const DOMAIN = at("src/modules/domain/order/placing.service.ts")
const API_HANDLER = at("src/features/checkout/application/show-xp.handler.ts")
const REACTOR = at("src/features/reactors/stock/stock.consumer.ts")
const JOB = at("src/features/jobs/send/send.processor.ts")
const WORLD = at("src/tests/world/use-test-world.ts")

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

const ENTITY = `import type { EntityManager } from "typeorm"
import { UserXpProjectionEntity } from "@modules/projections/userxp/user-xp.projection-entity"
`

test("projection-write-owner: a read-model table is written only by its own projection", () => {
    tester.run("projection-write-owner", projectionWriteOwner, {
        valid: [
            { filename: PROJECTION, code: `${ENTITY}export const recompute = (manager: EntityManager) => manager.update(UserXpProjectionEntity, { userId: "a" }, { total: 1 })` },
            { filename: PROJECTION, code: `${ENTITY}export const wipe = (manager: EntityManager) => manager.delete(UserXpProjectionEntity, {})` },
            { filename: PROJECTION, code: `${ENTITY}export const read = (manager: EntityManager) => manager.find(UserXpProjectionEntity, {})` },
            { filename: DOMAIN, code: `${ENTITY}export const read = (manager: EntityManager) => manager.find(UserXpProjectionEntity, {})` },
            { filename: DOMAIN, code: `import type { EntityManager } from "typeorm"\nimport { OrderEntity } from "./persistence/entities/order.entity"\nexport const w = (manager: EntityManager) => manager.update(OrderEntity, { id: "a" }, { status: "x" })` },
            { filename: WORLD, code: `${ENTITY}export const seed = (manager: EntityManager, row: UserXpProjectionEntity) => manager.save(row)` },
        ],
        invalid: [
            { filename: DOMAIN, code: `${ENTITY}export const w = (manager: EntityManager) => manager.update(UserXpProjectionEntity, { userId: "a" }, { total: 9 })`, errors: [{ messageId: "foreign" }] },
            { filename: API_HANDLER, code: `${ENTITY}export const w = (manager: EntityManager, row: UserXpProjectionEntity) => manager.save(row)`, errors: [{ messageId: "foreign" }] },
            { filename: OTHER_PROJECTION, code: `${ENTITY}export const w = (manager: EntityManager) => manager.increment(UserXpProjectionEntity, { userId: "a" }, "total", 1)`, errors: [{ messageId: "foreign" }] },
            { filename: CONTRACTS, code: `${ENTITY}export const w = (manager: EntityManager) => manager.delete(UserXpProjectionEntity, {})`, errors: [{ messageId: "foreign" }] },
            { filename: DOMAIN, code: `${ENTITY}export const w = (manager: EntityManager) => manager.createQueryBuilder().update(UserXpProjectionEntity).set({ total: 1 }).execute()`, errors: [{ messageId: "foreign" }] },
        ],
    })
})

const PROJECTION_HEAD = `import { UserXpProjectionEntity } from "./user-xp.projection-entity"\n`

test("projection-shape: recompute and get only, the entity stays inside, and the api never recomputes", () => {
    tester.run("projection-shape", projectionShape, {
        valid: [
            { filename: PROJECTION, code: `${PROJECTION_HEAD}export class UserXpProjection {\n async recomputeUserXp(): Promise<void> {}\n async getUserXp(): Promise<number> { return 0 }\n private tidy(): void { void UserXpProjectionEntity }\n}` },
            { filename: PROJECTION, code: `export class UserXpProjection { constructor(private readonly n: number) {}\n async recompute(): Promise<void> {}\n async get(): Promise<number> { return this.n } }` },
            { filename: PROJECTION_INDEX, code: `export { UserXpProjection } from "./user-xp.projection"` },
            { filename: API_HANDLER, code: `import type { UserXpProjection } from "@modules/projections/userxp"\nexport const show = (projection: UserXpProjection) => projection.getUserXp("a")` },
            { filename: REACTOR, code: `import type { UserXpProjection } from "@modules/projections/userxp"\nexport const react = (projection: UserXpProjection) => projection.recomputeUserXp("a", 1)` },
            { filename: JOB, code: `import type { UserXpProjection } from "@modules/projections/userxp"\nexport const rebuild = (projection: UserXpProjection) => projection.recomputeUserXp("a", 1)` },
        ],
        invalid: [
            { filename: PROJECTION, code: `export class UserXpProjection {\n async rebuildEverything(): Promise<void> {}\n}`, errors: [{ messageId: "vocabulary" }] },
            { filename: PROJECTION, code: `export class UserXpProjection {\n async recomputeUserXp(): Promise<void> {}\n async set(): Promise<void> {}\n}`, errors: [{ messageId: "vocabulary" }] },
            { filename: PROJECTION_INDEX, code: `export { UserXpProjection } from "./user-xp.projection"\nexport { UserXpProjectionEntity } from "./user-xp.projection-entity"`, errors: [{ messageId: "entityExported" }] },
            { filename: API_HANDLER, code: `import type { UserXpProjection } from "@modules/projections/userxp"\nexport const show = (projection: UserXpProjection) => projection.recomputeUserXp("a", 1)`, errors: [{ messageId: "apiRecompute" }] },
        ],
    })
})
