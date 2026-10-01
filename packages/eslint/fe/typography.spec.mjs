/**
 * Twin tests for the typography rule.
 *
 *   node --test typography.spec.mjs
 *
 * Two exemptions decide whether this rule is honest: the component that OWNS the tag has to be
 * allowed to write it, and a twin test has to be allowed to build heading markup to assert
 * against. A rule that forbade both would be a rule with no correct way to satisfy it.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, slotTester } from "./fixtures/typed/tester.mjs"
import { noHeadingTagOutsideHeadingComponent, rules } from "./typography.mjs"

const tester = slotTester()

const BLOCK = at("apps/web/src/components/blocks/DailyQuest/component.tsx")
const OWNER = at("apps/web/src/components/leaves/Heading/index.tsx")

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("TYPESET-1: a heading comes from the component that owns tag and size together", () => {
  tester.run("no-heading-tag-outside-heading-component", noHeadingTagOutsideHeadingComponent, {
    valid: [
      { filename: BLOCK, code: "const E = () => <Heading props={{ content: t, level: 2 }} />" },
      // the component that owns both facts is the one file allowed to write the tag
      { filename: OWNER, code: "const E = () => <h2 />" },
      // a twin builds heading markup on purpose, to assert against it
      // a span is not a heading, whatever it is styled like - that case is tokens.mjs's
      { filename: BLOCK, code: "const E = () => <span />" },
      // the owner's drawing half is the owner too, in every app
      { filename: at("apps/web/src/components/leaves/Heading/component.tsx"), code: "const E = () => <h2 />" },
      { filename: at("apps/admin/src/components/leaves/Heading/index.tsx"), code: "const E = () => <h2 />" },
    ],
    invalid: [
      { filename: BLOCK, code: "const E = () => <h1 />", errors: [{ messageId: "tag" }] },
      { filename: BLOCK, code: "const E = () => <h3>{title}</h3>", errors: [{ messageId: "tag" }] },
      // past the scale: a structure problem, and the message says so
      // a Heading owner outside the leaves layer, and a leaf of another name, are not the heading component
      { filename: at("apps/web/src/components/blocks/Heading/index.tsx"), code: "const E = () => <h2 />", errors: [{ messageId: "tag" }] },
      { filename: at("apps/web/src/components/leaves/Title/index.tsx"), code: "const E = () => <h2 />", errors: [{ messageId: "tag" }] },
      { filename: BLOCK, code: "const E = () => <h5 />", errors: [{ messageId: "tooDeep" }] },
      { filename: BLOCK, code: "const E = () => <h6 />", errors: [{ messageId: "tooDeep" }] },
    ],
  })
})
