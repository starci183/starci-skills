import assert from "node:assert/strict"
import test from "node:test"
import { monorepoTierBelongsToItsSide } from "./file-layout.mjs"
import { serverModuleMarksServerOnly } from "./client-boundary.mjs"
import { isOutcomeModule } from "./lib/scope.mjs"
import { at, FE_DECLARATION, slotTester, typedTester } from "./fixtures/typed/tester.mjs"

const ONE_APP = {
  ...FE_DECLARATION,
  apps: [{ name: "web", kind: "next" }],
}

test("one app may own shell composites while two apps must share them", () => {
  slotTester({ declaration: ONE_APP }).run("one-app composite", monorepoTierBelongsToItsSide, {
    valid: [{
      filename: at("apps/web/src/components/composites/SiteShell/index.tsx"),
      code: "export const SiteShell = () => null",
    }],
    invalid: [],
  })
  slotTester().run("two-app composite", monorepoTierBelongsToItsSide, {
    valid: [],
    invalid: [{
      filename: at("apps/web/src/components/composites/SiteShell/index.tsx"),
      code: "export const SiteShell = () => null",
      errors: [{ messageId: "vocabularyInApp" }],
    }],
  })
})

test("the Outcome home follows slot data rather than a remembered slot id", () => {
  const context = (slot, outcomeHome) => ({
    filename: at("apps/web/src/modules/custom/result.ts"),
    settings: { starci: { hfs: {
      slotOf: () => slot,
      slot: id => id === slot ? { outcomeHome } : null,
    } } },
  })

  assert.equal(isOutcomeModule(context("fe.custom.result", true)), true)
  assert.equal(isOutcomeModule(context("fe.transport.outcome", false)), false)
  assert.equal(isOutcomeModule(context(null, true)), false)
})

test("the server-only marker follows a BOM/CRLF directive prologue", () => {
  typedTester().run("server marker after directives", serverModuleMarksServerOnly, {
    valid: [{
      filename: at("apps/web/src/modules/orders/write-order.ts"),
      code: '\uFEFF"use strict";\r\n"use server";\r\nimport "server-only";\r\nimport { headers } from "next/headers";\r\nexport const writeOrder = async () => headers();\r\n',
    }],
    invalid: [{
      filename: at("apps/web/src/modules/orders/write-order.ts"),
      code: 'import { headers } from "next/headers";\r\n"use server";\r\nimport "server-only";\r\nexport const writeOrder = async () => headers();\r\n',
      errors: [{ messageId: "mark" }],
    }],
  })
})
