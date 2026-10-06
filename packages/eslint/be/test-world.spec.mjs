/**
 * Twin tests for the `test-world` law (R47, owner test layout 2026-09-30).
 *
 *   node --test test-world.spec.mjs
 */
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { rules, testWorldShape, testsInfraOnlyInWorld, testsNoOverride } from "./test-world.mjs"
import assert from "node:assert/strict"

const tester = typedTester()
const E2E = at("src/tests/e2e/checkout/place-order.e2e-spec.ts")
const INTEGRATION = at("src/tests/integration/order/place-order.integration-spec.ts")
const CONTRACT = at("src/tests/contract/payos/checkout.contract-spec.ts")
const FIXTURE = at("src/tests/fixtures/order.builders.ts")
const WORLD = at("src/tests/world/global-setup.ts")
const USE_WORLD = at("src/tests/world/use-test-world.ts")
const MIGRATION = '"../../../modules/domain/order/persistence/migrations/1700000000000-create-orders"'
const LIST = '"../../../modules/domain/order/order.migrations"'
const MANAGER = 'import type { EntityManager } from "typeorm"\n'

test("the law publishes its three rules", () => {
    assert.deepEqual(Object.keys(rules).sort(), ["test-world-shape", "tests-infra-only-in-world", "tests-no-override"])
})

test("R47: only src/tests/world starts infrastructure, migrates, holds a DataSource or writes process.env", () => {
    tester.run("tests-infra-only-in-world", testsInfraOnlyInWorld, {
        valid: [
            { filename: E2E, code: `${MANAGER}declare const world: { db: { primary: EntityManager } }\nexport const rows = world.db.primary.find(Object)` },
            { filename: WORLD, code: 'import { PostgreSqlContainer } from "@testcontainers/postgresql"\nimport { DataSource } from "typeorm"\nexport const db = new PostgreSqlContainer("postgres:16")\ndeclare const source: DataSource\nvoid source.runMigrations()\nprocess.env.PRIMARY_DB_HOST = "localhost"' },
            { filename: E2E, code: "declare const settings: { synchronize(): void }\nsettings.synchronize()\nexport const port = process.env.PORT" },
        ],
        invalid: [
            { filename: E2E, code: `import { CreateOrders1700000000000 } from ${MIGRATION}\nexport const m = CreateOrders1700000000000`, errors: [{ messageId: "migration" }] },
            { filename: INTEGRATION, code: `import { orderMigrations } from ${'"../../../modules/domain/order/order.migrations"'}\nexport const m = orderMigrations`, errors: [{ messageId: "migration" }] },
            { filename: E2E, code: 'import { migrate } from "../../../../apps/cli/src/main"\nexport const run = migrate', errors: [{ messageId: "migration" }] },
            { filename: FIXTURE, code: 'import { DataSource } from "typeorm"\nexport type S = DataSource', errors: [{ messageId: "infra" }] },
            { filename: INTEGRATION, code: `${MANAGER}declare const manager: EntityManager\nconst db = manager\nvoid db.synchronize()`, errors: [{ messageId: "call" }] },
            { filename: CONTRACT, code: 'import { PostgreSqlContainer } from "@testcontainers/postgresql"\nexport const db = new PostgreSqlContainer("postgres:16")', errors: [{ messageId: "infra" }, { messageId: "infra" }] },
            { filename: E2E, code: 'process.env.PRIMARY_DB_HOST = "x"', errors: [{ messageId: "env" }] },
            { filename: E2E, code: 'delete process.env["PRIMARY_DB_HOST"]', errors: [{ messageId: "env" }] },
            { filename: E2E, code: 'Object.assign(process.env, { A: "1" })', errors: [{ messageId: "env" }] },
            { filename: E2E, code: `import { orderMigrations } from ${LIST}\nexport const m = orderMigrations`, errors: [{ messageId: "migration" }] },
        ],
    })
})

test("R47: nothing under src/tests overrides a provider", () => {
    const moduleRef = "declare const moduleRef: { overrideProvider(token: unknown): unknown; overrideGuard(guard: unknown): unknown }\n"
    tester.run("tests-no-override", testsNoOverride, {
        valid: [
            { filename: USE_WORLD, code: "declare function startHttpFake(name: string): { url: string }\nexport const payos = startHttpFake('payos')" },
            // a colocated unit spec is not under src/tests
            { filename: at("src/modules/domain/order/order.service.spec.ts"), code: `${moduleRef}moduleRef.overrideProvider(1)\nexport const p = { provide: 1, useValue: 2 }` },
        ],
        invalid: [
            { filename: E2E, code: `${moduleRef}moduleRef.overrideProvider(1)`, errors: [{ messageId: "override" }] },
            { filename: USE_WORLD, code: `${moduleRef}moduleRef.overrideGuard(1)`, errors: [{ messageId: "override" }] },
            { filename: INTEGRATION, code: "export const p = { provide: 1, useValue: 2 }", errors: [{ messageId: "override" }] },
            { filename: FIXTURE, code: "declare const jest: { mock(path: string): void }\njest.mock('axios')", errors: [{ messageId: "override" }] },
        ],
    })
})

test("R47: integration asks for { modules } (peer apps may join as apps), e2e for { apps }", () => {
    const world = "declare function useTestWorld(options: object): object\n"
    tester.run("test-world-shape", testWorldShape, {
        valid: [
            { filename: INTEGRATION, code: `${world}export const world = useTestWorld({ modules: [] })` },
            { filename: E2E, code: `${world}export const world = useTestWorld({ apps: { order: {} } })` },
            { filename: INTEGRATION, code: `${world}const modules = []
export const world = useTestWorld({ modules })` },
            { filename: E2E, code: `${world}export const world = useTestWorld({ "apps": { order: {} } })` },
            { filename: INTEGRATION, code: `${world}export const world = useTestWorld({ modules: [], apps: ["order"] })` },
            { filename: INTEGRATION, code: `${world}export const world = useTestWorld({ modules: [], ["apps"]: ["order"] })` },
        ],
        invalid: [
            { filename: INTEGRATION, code: `${world}const spec = { modules: [] }
export const world = useTestWorld(spec)`, errors: [{ messageId: "literal" }] },
            { filename: INTEGRATION, code: `${world}declare const extra: object
export const world = useTestWorld({ modules: [], ...extra })`, errors: [{ messageId: "literal" }] },
            { filename: INTEGRATION, code: `${world}declare const apps: string
export const world = useTestWorld({ modules: [], [apps]: {} })`, errors: [{ messageId: "literal" }] },
            { filename: INTEGRATION, code: `${world}export const world = useTestWorld({})`, errors: [{ messageId: "modules" }] },
            { filename: INTEGRATION, code: `${world}export const world = useTestWorld()`, errors: [{ messageId: "literal" }] },
            { filename: INTEGRATION, code: `${world}export const world = useTestWorld({ apps: {} })
export const again = useTestWorld({ modules: [] })`, errors: [{ messageId: "modules" }] },
            { filename: E2E, code: `${world}const alias = useTestWorld
export const world = alias({ apps: {} })`, errors: [{ messageId: "missing" }] },
            { filename: INTEGRATION, code: `${world}export const world = useTestWorld({ apps: { order: {} } })`, errors: [{ messageId: "modules" }] },
            { filename: E2E, code: `${world}export const world = useTestWorld({ modules: [] })`, errors: [{ messageId: "apps" }] },
            { filename: E2E, code: "export const nothing = 1", errors: [{ messageId: "missing" }] },
        ],
    })
})
