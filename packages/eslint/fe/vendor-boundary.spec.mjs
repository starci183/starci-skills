import assert from "node:assert/strict"
import test from "node:test"
import { at, slotTester } from "./fixtures/typed/tester.mjs"
import { rules, recommended, vendorPrimitiveHasNamedOwner } from "./vendor-boundary.mjs"

test("vendor boundary publishes only ordinary ownership rules", () => {
  assert.deepEqual(Object.keys(rules).sort(), [
    "vendor-primitive-has-named-owner",
  ].sort())
  assert.deepEqual(Object.keys(recommended).sort(), Object.keys(rules).map((name) => `starci-fe/${name}`).sort())
})

test("leaves, branches and colocated classNames modules own the HeroUI primitives", () => {
  const tester = slotTester()
  const HEROUI = "import { Card } from '@heroui/react'"
  tester.run("vendor-primitive-has-named-owner", vendorPrimitiveHasNamedOwner, {
    valid: [
      { filename: at("apps/web/src/components/blocks/CourseCard/classNames.ts"), code: "import { cn } from '@heroui/react'" },
      { filename: at("apps/web/src/components/leaves/Badge/index.tsx"), code: HEROUI },
      { filename: at("apps/web/src/components/branches/Modal/component.tsx"), code: HEROUI },
      // a shared package leaf and its classNames are owners too
      { filename: at("packages/nivo-ui/src/leaves/Badge/index.tsx"), code: HEROUI },
      { filename: at("packages/nivo-ui/src/composites/Card/classNames.ts"), code: HEROUI },
      // not a component owner: the folder name alone does not make one, and no slot owns overlays
      { filename: at("apps/web/src/modules/components/x.ts"), code: HEROUI },
      { filename: at("apps/web/src/components/overlays/Modal/index.tsx"), code: HEROUI },
      { filename: at("apps/web/src/components/blocks/CourseCard/index.tsx"), code: "import { x } from 'other'" },
    ],
    invalid: [
      { filename: at("apps/web/src/components/blocks/CourseCard/index.tsx"), code: HEROUI, errors: [{ messageId: "owner" }] },
      { filename: at("apps/web/src/components/composites/Row/component.tsx"), code: HEROUI, errors: [{ messageId: "owner" }] },
      { filename: at("packages/nivo-ui/src/composites/Row/index.tsx"), code: HEROUI, errors: [{ messageId: "owner" }] },
    ],
  })
})
