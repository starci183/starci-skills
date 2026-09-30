/**
 * Twin tests for `spec-typed-entity-manager` (R48, test policy 2026-09-30).
 *
 *   node --test spec-typed-entity-manager.test.mjs
 */
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { specTypedEntityManager } from "./spec-quality.mjs"

const SPEC = at("src/features/checkout/application/place.handler.spec.ts")
const FIXTURE = '"../../../tests/fixtures/database"'

test("R48: a unit spec's database double is the fixture's typed fake", () => {
    typedTester().run("spec-typed-entity-manager", specTypedEntityManager, {
        valid: [
            { filename: SPEC, code: `import { mockEntityManager, fakeTransaction } from ${FIXTURE}\nconst manager = mockEntityManager({ orders: [] })\nexport const tx = fakeTransaction(manager)` },
            // not a spec: the rule has nothing to say
            { filename: at("src/features/checkout/application/place.handler.ts"), code: 'import type { EntityManager } from "typeorm"\ndeclare function mock<T>(): T\nexport const m = mock<EntityManager>()' },
        ],
        invalid: [
            { filename: SPEC, code: 'import type { EntityManager } from "typeorm"\ndeclare function mock<T>(): T\nexport const m = mock<EntityManager>()', errors: [{ messageId: "adhoc" }] },
            { filename: SPEC, code: 'import type { QueryRunner } from "typeorm"\ndeclare function mock<T>(): T\nexport const r = mock<QueryRunner>()', errors: [{ messageId: "adhoc" }] },
            { filename: SPEC, code: `import { mockEntityManager } from ${FIXTURE}\ndeclare const jest: { fn(): () => Promise<Array<object>> }\nconst manager = mockEntityManager()\nmanager.find = jest.fn()`, errors: [{ messageId: "adhoc" }] },
        ],
    })
})
