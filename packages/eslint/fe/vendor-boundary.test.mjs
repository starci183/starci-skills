import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import { rules, recommended, vendorPrimitiveHasNamedOwner } from "./vendor-boundary.mjs"

test("vendor boundary publishes only ordinary ownership rules", () => {
  assert.deepEqual(Object.keys(rules).sort(), [
    "no-internal-starci-href",
    "no-direct-heroicon-import",
    "vendor-primitive-has-named-owner",
  ].sort())
  assert.deepEqual(Object.keys(recommended).sort(), Object.keys(rules).map((name) => `starci-fe/${name}`).sort())
})

test("colocated classNames modules own the HeroUI cn helper", () => {
  const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } })
  tester.run("vendor-primitive-has-named-owner", vendorPrimitiveHasNamedOwner, {
    valid: [{ filename: "D:/repo/src/components/blocks/CourseCard/classNames.ts", code: "import { cn } from '@heroui/react'" }],
    invalid: [{ filename: "D:/repo/src/components/blocks/CourseCard/index.tsx", code: "import { Card } from '@heroui/react'", errors: [{ messageId: "owner" }] }],
  })
})
