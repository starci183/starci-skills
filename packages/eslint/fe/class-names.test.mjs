import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { classNamesInColocatedFile, cnArgumentsAreSingleTokens, noInlineClassName, rules } from "./class-names.mjs"

const tester = new RuleTester({ languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } } })
const COMPONENT = "D:/repo/src/components/leaves/Badge/index.tsx"
const STYLES = "D:/repo/src/components/leaves/Badge/classNames.ts"

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
    ],
    invalid: [
      { filename: COMPONENT, code: "const C = () => <div className=\"flex gap-2\" />", errors: [{ messageId: "inline" }] },
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
    valid: [{ filename: COMPONENT, code: "import { badgeClassName } from './classNames'; const C = () => <div className={badgeClassName} />" }],
    invalid: [{ filename: COMPONENT, code: "const badgeClassName = cn(\"flex\")", errors: [{ messageId: "misplaced" }] }],
  })
})

test("cn receives one utility token per variadic argument", () => {
  tester.run("cn-arguments-are-single-tokens", cnArgumentsAreSingleTokens, {
    valid: [
      { filename: STYLES, code: "export const badgeClassName = cn(\"inline-flex\", active ? \"text-success\" : undefined)" },
      { filename: STYLES, code: "export const getBadgeClassName = (active) => cn(active && \"text-success\", active ? \"font-bold\" : undefined)" },
    ],
    invalid: [
      { filename: STYLES, code: "export const badgeClassName = cn([\"flex\", \"gap-2\"])", errors: [{ messageId: "array" }] },
      { filename: STYLES, code: "export const badgeClassName = cn(\"flex gap-2\")", errors: [{ messageId: "token" }] },
      { filename: STYLES, code: "export const badgeClassName = cn(\"gap-1,5\")", errors: [{ messageId: "token" }] },
      { filename: STYLES, code: "export const badgeClassName = cn(active ? \"flex gap-2\" : \"flex\")", errors: [{ messageId: "token" }] },
      { filename: STYLES, code: "export const badgeClassName = cn(active ? \"text-1,5\" : undefined)", errors: [{ messageId: "token" }] },
      { filename: STYLES, code: "const privateClassName = cn(\"flex\")", errors: [{ messageId: "unexported" }] },
    ],
  })
})
