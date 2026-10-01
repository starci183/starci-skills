/**
 * Twin tests for `spec-typed-entity-manager` (R48, unit-test standard 2026-09-30).
 *
 *   node --test spec-typed-entity-manager.test.mjs
 */
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { specTypedEntityManager } from "./spec-quality.mjs"

const SPEC = at("src/modules/domain/order/order.service.spec.ts")
const KIT = 'import { mockEntityManager, fakeTransaction, mock } from "@starci/jest-preset"\n'

test("R48: a unit spec's database double is the kit's mockEntityManager from @starci/jest-preset", () => {
    typedTester().run("spec-typed-entity-manager", specTypedEntityManager, {
        valid: [
            { filename: SPEC, code: `${KIT}const manager = mockEntityManager()\nexport const tx = fakeTransaction(manager)` },
            { filename: SPEC, code: `import { mockEntityManager as em } from "@starci/jest-preset"\nexport const manager = em({ find: [Object, []] })` },
            // a spec may mock other things with the kit
            { filename: SPEC, code: `${KIT}interface Port { ping(): void }\nexport const port = mock<Port>()` },
            // not a spec: the rule has nothing to say
            { filename: at("src/modules/domain/order/order.service.ts"), code: 'import type { EntityManager } from "typeorm"\ndeclare function make<T>(): T\nexport const m = make<EntityManager>()' },
        ],
        invalid: [
            // an ad-hoc typed double, local or from the kit's generic mock
            { filename: SPEC, code: 'import type { EntityManager } from "typeorm"\ndeclare function mock<T>(): T\nexport const m = mock<EntityManager>()', errors: [{ messageId: "adhoc" }] },
            { filename: SPEC, code: `${KIT}import type { EntityManager } from "typeorm"\nexport const m = mock<EntityManager>()`, errors: [{ messageId: "adhoc" }] },
            { filename: SPEC, code: 'import type { QueryRunner } from "typeorm"\ndeclare function mock<T>(): T\nexport const r = mock<QueryRunner>()', errors: [{ messageId: "adhoc" }] },
            // a fixture file is no longer a source of the double, and neither is a same-named lookalike
            { filename: SPEC, code: 'import { mockEntityManager } from "../../../tests/fixtures/database"\nexport const m = mockEntityManager()', errors: [{ messageId: "adhoc" }] },
            { filename: SPEC, code: 'import type { EntityManager } from "typeorm"\nexport const mockEntityManager = (): EntityManager => { throw new Error("x") }\nexport const m = mockEntityManager()', errors: [{ messageId: "adhoc" }] },
            // stubbing a member of the manager by hand
            { filename: SPEC, code: `${KIT}declare const jest: { fn(): () => Promise<Array<object>> }\nconst manager = mockEntityManager()\nmanager.find = jest.fn()`, errors: [{ messageId: "adhoc" }] },
        ],
    })
})
