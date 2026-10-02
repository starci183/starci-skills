/**
 * Twin tests for the service-isolation rule (R141).
 *
 *   node --test service-isolation.spec.mjs
 *
 * The app that owns a file comes from the HFS slot view of an in-memory declaration of two service apps, so every case is a
 * virtual file under the fixture repository: a service app importing a sibling service app is refused, the shared `src`
 * libraries and its own files are not.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { recommended, rules, serviceIsolation } from "./service-isolation.mjs"

const TWO_SERVICES = {
  apps: [
    { name: "order", kind: "api" },
    { name: "billing", kind: "worker" },
    { name: "migrate", kind: "migrate" },
  ],
  connections: [{ name: "primary", envPrefix: "PRIMARY_DB" }],
}
const tester = typedTester({ declaration: TWO_SERVICES })

const IN_ORDER = at("apps/order/src/app.module.ts")
const IN_BILLING = at("apps/billing/src/app.module.ts")
const IN_LIBRARY = at("src/modules/domain/plan/plan.service.ts")

test("the rule is published under its name at error", () => {
  assert.deepEqual(Object.keys(rules), ["service-isolation"])
  assert.equal(recommended["starci-be/service-isolation"], "error")
})

test("R141: a service app imports no sibling service app", () => {
  tester.run("service-isolation", serviceIsolation, {
  valid: [
    { name: "a service app imports its own files", filename: IN_ORDER, code: 'import { options } from "./order.options"\nexport const x = options\n' },
    { name: "a service app imports a shared library", filename: IN_ORDER, code: 'import { PlanModule } from "../../../src/modules/domain/plan"\nexport const x = PlanModule\n' },
    { name: "a library file importing a sibling file is not a service app file", filename: IN_LIBRARY, code: 'import { x } from "./other"\nexport const y = x\n' },
    { name: "a package import is no sibling app", filename: IN_BILLING, code: 'import { Module } from "@nestjs/common"\nexport const m = Module\n' },
  ],
  invalid: [
    {
      name: "a service app imports a sibling service app by a relative path",
      filename: IN_ORDER,
      code: 'import { AppModule } from "../../billing/src/app.module"\nexport const x = AppModule\n',
      errors: [{ messageId: "sibling", data: { specifier: "../../billing/src/app.module", self: "order", other: "billing" } }],
    },
    {
      name: "a worker app re-exporting a sibling's options is refused too",
      filename: IN_BILLING,
      code: 'export { orderOptions } from "../../order/src/order.options"\n',
      errors: [{ messageId: "sibling" }],
    },
  ],
})
})
