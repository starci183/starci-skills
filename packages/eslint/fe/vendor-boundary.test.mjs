import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import { noInternalStarciHref, rules, recommended, vendorPrimitiveHasNamedOwner } from "./vendor-boundary.mjs"

test("vendor boundary publishes only ordinary ownership rules", () => {
  assert.deepEqual(Object.keys(rules).sort(), [
    "no-internal-starci-href",
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

test("internal links use the routed navigation owner", () => {
  const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } } })
  tester.run("no-internal-starci-href", noInternalStarciHref, {
    valid: [
      { filename: "/repo/apps/web/src/components/leaves/Mail/index.tsx", code: "export const Mail = () => <a href=\"mailto:hi@example.com\">x</a>" },
      { filename: "/repo/apps/web/src/modules/routes/links.ts", code: "export const x = 1" },
    ],
    invalid: [
      { filename: "/repo/apps/web/src/components/leaves/Home/index.tsx", code: "export const Home = () => <a href=\"/tasks\">x</a>", errors: [{ messageId: "href" }] },
    ],
  })
})
