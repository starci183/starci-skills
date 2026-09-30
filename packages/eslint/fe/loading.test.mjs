/**
 * Twin tests for the loading rules.
 *
 *   node --test loading.test.mjs
 *
 * The case that decides whether these rules are liveable is the `null` arm. A control that has
 * nowhere to go YET is drawn as nothing on purpose - LOADING-5 - and a rule that read that as a
 * second tree would fire on the correct shape, which is how a rule earns a blanket disable.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, slotTester } from "./fixtures/typed/tester.mjs"
import { noPlaceholderProp, noRestingBranchAtCallSite, noRestingTwinComponent, rules } from "./loading.mjs"

const tester = slotTester()

const BLOCK = at("apps/web/src/components/blocks/DailyQuest/component.tsx")
const TWIN = at("apps/web/src/components/blocks/DailyQuestSkeleton/index.tsx")
const TWIN_TEST = at("apps/web/src/components/blocks/DailyQuestSkeleton/index.test.tsx")
const HOOK = at("apps/web/src/hooks/swr/useX.ts")

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("LOADING-1: no component exists to mirror another one's shape", () => {
  tester.run("no-resting-twin-component", noRestingTwinComponent, {
    valid: [
      { filename: BLOCK, code: "export const X = () => null" },
      // a twin's own test may exist while the twin is being folded back in
      { filename: TWIN_TEST, code: "export const X = () => null" },
      // outside the component tree there is no shape to mirror
      { filename: HOOK, code: "export const X = () => null" },
      // a folder named components inside a module is no component owner, whatever it is called
      { filename: at("apps/web/src/modules/components/DailyQuestSkeleton/index.tsx"), code: "export const X = () => null" },
      // a package layer folder is not an owner of its own in the slot (the owner is the package): not judged by name
      { filename: at("packages/nivo-ui/src/leaves/DailyQuestSkeleton/index.tsx"), code: "export const DailyQuestSkeleton = () => null" },
      // only the owner's entry is the twin; its styling file is not a second twin
      { filename: at("apps/web/src/components/blocks/DailyQuestSkeleton/classNames.ts"), code: "export const x = 1" },
    ],
    invalid: [
      { filename: TWIN, code: "export const DailyQuestSkeleton = () => null", errors: [{ messageId: "twin" }] },
    ],
  })
})

test("LOADING-1: a ready-made resting shape is not handed in", () => {
  tester.run("no-placeholder-prop", noPlaceholderProp, {
    valid: [
      { filename: BLOCK, code: "const E = () => <Card isLoading={pending} />" },
      // the primitive a component rests WITH is not a twin of one
      { filename: BLOCK, code: "import { Skeleton } from \"./Skeleton\"" },
      // a string fallback is not a tree
      { filename: BLOCK, code: "const E = () => <Card fallback=\"none yet\" />" },
    ],
    invalid: [
      {
        filename: BLOCK,
        code: "const E = () => <Card skeleton={<Rows />} />",
        errors: [{ messageId: "prop" }],
      },
      {
        filename: BLOCK,
        code: "import { DailyQuestSkeleton } from \"./DailyQuestSkeleton\"",
        errors: [{ messageId: "import" }],
      },
    ],
  })
})

test("LOADING-2: a waiting flag never picks between two different components", () => {
  tester.run("no-resting-branch-at-call-site", noRestingBranchAtCallSite, {
    valid: [
      // one description, two states
      { filename: BLOCK, code: "const E = () => <Avatar props={{ name }} isLoading={isLoading} />" },
      // the same component on both sides is the honest form
      { filename: BLOCK, code: "const E = () => isLoading ? <Row props={a} /> : <Row props={b} />" },
      // LOADING-5: a control with nowhere to go yet is drawn as nothing, on purpose
      { filename: BLOCK, code: "const E = () => isLoading ? null : <SeeMoreLink props={p} />" },
      // a flag that is not about waiting is not this rule's business
      { filename: BLOCK, code: "const E = () => isOwnRow ? <Mine /> : <Theirs />" },
    ],
    invalid: [
      {
        filename: BLOCK,
        code: "const E = () => isLoading ? <RowSkeleton /> : <Row props={p} />",
        errors: [{ messageId: "branch" }],
      },
      {
        filename: BLOCK,
        code: "const E = () => isPending ? <Placeholder /> : <Chart props={p} />",
        errors: [{ messageId: "branch" }],
      },
    ],
  })
})
