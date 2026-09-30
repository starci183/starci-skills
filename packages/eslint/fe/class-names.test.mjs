import assert from "node:assert/strict"
import test from "node:test"
import { at, fixtureHfs, slotTester } from "./fixtures/typed/tester.mjs"
import { classNamesInColocatedFile, cnArgumentsAreSingleTokens, noInlineClassName, rules } from "./class-names.mjs"

const tester = slotTester()
const COMPONENT = at("apps/web/src/components/leaves/Badge/index.tsx")
const STYLES = at("apps/web/src/components/leaves/Badge/classNames.ts")
const PACKAGE_LEAF = at("packages/nivo-ui/src/leaves/Badge/index.tsx")
const PACKAGE_STYLES = at("packages/nivo-ui/src/leaves/Badge/classNames.ts")
const NOT_A_COMPONENT = at("apps/web/src/modules/components/Badge.tsx")

test("exports every classNames rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule.meta && rule.create, `${name} is not an ESLint rule`)
})

test("recommended keys use the plugin namespace", async () => {
  const { recommended } = await import("./class-names.mjs")
  assert.deepEqual(Object.keys(recommended), Object.keys(rules).map((name) => `starci-fe/${name}`))
})

test("reads sourceCode from the ESLint 10 rule context", () => {
  const listeners = noInlineClassName.create({
    filename: COMPONENT,
    settings: { starci: { hfs: fixtureHfs() } },
    sourceCode: { ast: { body: [] } },
  })

  assert.equal(typeof listeners.JSXAttribute, "function")
})

test("component JSX consumes imported class names", () => {
  tester.run("no-inline-class-name", noInlineClassName, {
    valid: [
      { filename: COMPONENT, code: "import { badgeClassName } from './classNames'; const C = () => <div className={badgeClassName} />" },
      { filename: COMPONENT, code: "import { getBadgeClassName } from './classNames'; const C = (props) => <div className={getBadgeClassName(props.tone)} />" },
      { filename: COMPONENT, code: "import * as badgeClasses from './classNames'; const C = (props) => <div className={badgeClasses.getBadgeClassName(props.tone)} />" },
      { filename: COMPONENT, code: "import { badgeClassNames } from './classNames'; const C = (props) => <div className={badgeClassNames[props.tone]} />" },
      { filename: COMPONENT, code: "import { badgeClassName, getBadgeClassName } from './classNames'; const C = (props) => <div className={props.active ? getBadgeClassName(props.tone) : badgeClassName} />" },
      { filename: COMPONENT, code: "import { badgeClassName } from './classNames'; const C = (props) => <div className={props.active && badgeClassName} />" },
      { filename: COMPONENT, code: "import { badgeClassName } from './classNames'; const C = (props) => <div className={props.active ? badgeClassName : undefined} />" },
      // a folder named components inside a module is not a component owner
      { filename: NOT_A_COMPONENT, code: "const C = () => <div className=\"flex gap-2\" />" },
      // a file no slot owns is not judged by a folder-name rule
      { filename: at("apps/web/src/components/overlays/Modal/index.tsx"), code: "const C = () => <div className=\"flex\" />" },
      { filename: PACKAGE_LEAF, code: "import { badgeClassName } from './classNames'; const C = () => <div className={badgeClassName} />" },
    ],
    invalid: [
      { filename: COMPONENT, code: "const C = () => <div className=\"flex gap-2\" />", errors: [{ messageId: "inline" }] },
      // a shared package leaf is a component layer too
      { filename: PACKAGE_LEAF, code: "const C = () => <div className=\"flex gap-2\" />", errors: [{ messageId: "inline" }] },
      { filename: COMPONENT, code: "const C = () => <div className={cn(\"flex\", active && \"bg-success\")} />", errors: [{ messageId: "inline" }] },
      { filename: COMPONENT, code: "const C = () => <div className={badgeClassName} />", errors: [{ messageId: "inline" }] },
      { filename: COMPONENT, code: "import { otherClassName } from './otherStyles'; const C = () => <div className={otherClassName} />", errors: [{ messageId: "inline" }] },
      { filename: COMPONENT, code: "const C = (props) => <div className={getBadgeClassName(props.tone)} />", errors: [{ messageId: "inline" }] },
      { filename: COMPONENT, code: "import { getBadgeClassName } from './otherStyles'; const C = (props) => <div className={getBadgeClassName(props.tone)} />", errors: [{ messageId: "inline" }] },
      { filename: COMPONENT, code: "import { badgeClassName } from './classNames'; const C = (props) => <div className={props.active ? badgeClassName : 'flex'} />", errors: [{ messageId: "inline" }] },
    ],
  })
})

test("cn declarations live in colocated classNames files", () => {
  tester.run("class-names-in-colocated-file", classNamesInColocatedFile, {
    valid: [
      { filename: COMPONENT, code: "import { badgeClassName } from './classNames'; const C = () => <div className={badgeClassName} />" },
      { filename: STYLES, code: "export const badgeClassName = cn(\"flex\")" },
      { filename: PACKAGE_STYLES, code: "export const badgeClassName = cn(\"flex\")" },
      { filename: NOT_A_COMPONENT, code: "const badgeClassName = cn(\"flex\")" },
    ],
    invalid: [
      { filename: COMPONENT, code: "const badgeClassName = cn(\"flex\")", errors: [{ messageId: "misplaced" }] },
      { filename: PACKAGE_LEAF, code: "const badgeClassName = cn(\"flex\")", errors: [{ messageId: "misplaced" }] },
    ],
  })
})

test("cn receives one utility token per variadic argument", () => {
  tester.run("cn-arguments-are-single-tokens", cnArgumentsAreSingleTokens, {
    valid: [
      { filename: STYLES, code: "export const badgeClassName = cn(\"inline-flex\", active ? \"text-success\" : undefined)" },
      { filename: STYLES, code: "export const getBadgeClassName = (active) => cn(active && \"text-success\", active ? \"font-bold\" : undefined)" },
      // a classNames.ts outside a component owner is not judged here
      { filename: at("apps/web/src/modules/components/classNames.ts"), code: "const x = cn(\"flex gap-2\")" },
    ],
    invalid: [
      { filename: STYLES, code: "export const badgeClassName = cn([\"flex\", \"gap-2\"])", errors: [{ messageId: "array" }] },
      { filename: STYLES, code: "export const badgeClassName = cn(\"flex gap-2\")", errors: [{ messageId: "token" }] },
      { filename: STYLES, code: "export const badgeClassName = cn(\"gap-1,5\")", errors: [{ messageId: "token" }] },
      { filename: STYLES, code: "export const badgeClassName = cn(active ? \"flex gap-2\" : \"flex\")", errors: [{ messageId: "token" }] },
      { filename: STYLES, code: "export const badgeClassName = cn(active ? \"text-1,5\" : undefined)", errors: [{ messageId: "token" }] },
      { filename: PACKAGE_STYLES, code: "export const badgeClassName = cn(\"flex gap-2\")", errors: [{ messageId: "token" }] },
      { filename: STYLES, code: "const privateClassName = cn(\"flex\")", errors: [{ messageId: "unexported" }] },
    ],
  })
})
