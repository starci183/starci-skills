// proves: BE_TEST_BUILDER_ARRANGES@lite BE_TEST_BUILDER_ARRANGES@full
// proves: BE_SERVICE_ISOLATION@lite BE_SERVICE_ISOLATION@full
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { at, TYPED_ROOT, ruleTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { builderArrangesOnly } from "./builders.mjs"
import { serviceIsolation } from "./service-isolation.mjs"

const builder = at("src/tests/fixtures/builders/order.builder.ts")
const service = at("apps/order/src/app.module.ts")

for (const edition of ["lite", "full"]) {
    const hfs = hfsFromDeclaration({ ...appDeclaration("be", {
        apps: [{ name: "order", kind: "api" }, { name: "billing", kind: "worker" }],
    }), edition }, TYPED_ROOT)
    const tester = ruleTester({ root: TYPED_ROOT, hfs })

    test(`R101 ${edition}: valid deterministic builders pass and invalid assertion imports fail`, () => {
        tester.run("builder-arranges-only", builderArrangesOnly, {
            valid: [
                { filename: builder, code: 'export const arrange = () => ({ id: "order-1", createdAt: new Date("2026-01-01") })' },
                { filename: builder, code: 'const expect = (value: string) => value; export const id = expect("fixed")' },
                { filename: builder, code: 'import { fakeIds } from "@starci/jest-preset"; export const ids = fakeIds(["order-1"])' },
                { filename: service, code: 'import expect from "expect"; expect(1).toBe(1)' },
            ],
            invalid: [
                { filename: builder, code: 'import expect from "expect"; export const arrange = () => { expect(1).toBe(1); return { id: "fixed" } }', errors: [{ messageId: "assertion" }] },
                { filename: builder, code: 'import { expect as verify } from "expect"; verify(1).toBe(1)', errors: [{ messageId: "assertion" }] },
                { filename: builder, code: 'import * as assertions from "expect"; export const value = assertions', errors: [{ messageId: "assertion" }] },
                { filename: builder, code: 'import { expect as verify } from "@jest/globals"; verify(1).toBe(1)', errors: [{ messageId: "assertion" }] },
                { filename: builder, code: 'export const arrange = () => { expect(1).toBe(1); return { id: "fixed" } }', errors: [{ messageId: "assertion" }] },
                { filename: builder, code: 'export const id = Math.random()', errors: [{ messageId: "random" }] },
            ],
        })
    })

    test(`R168 ${edition}: valid own-app dynamic imports pass and invalid sibling imports fail`, () => {
        tester.run("service-isolation", serviceIsolation, {
            valid: [
                { filename: service, code: 'export const load = () => import("./order.options")' },
                { filename: service, code: 'export const load = () => import("../../../src/modules/domain/plan")' },
                { filename: service, code: 'export const load = () => import("@nestjs/common")' },
            ],
            invalid: [
                { filename: service, code: 'export const load = () => import("../../billing/src/app.module")', errors: [{ messageId: "sibling" }] },
                { filename: service, code: 'import { BillingModule } from "../../billing/src/app.module"', errors: [{ messageId: "sibling" }] },
                { filename: service, code: 'export * from "../../billing/src/app.module"', errors: [{ messageId: "sibling" }] },
            ],
        })
    })
}
