/** Focused tests for named React props and component-owned styling. */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  noCssDoorTypeLaundering,
  noInlineParameterType,
  noPerPartClassNameProp,
  noPublicClassNameProp,
  noPublicFrameCssProps,
  publicComponentSignature,
  rules,
} from "./props-and-slots.mjs"

const tester = new RuleTester({ languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } } })
const COMPONENT = "/repo/src/components/branches/SurfaceCard/index.tsx"

test("every exported rule has the ESLint rule shape", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule?.meta && rule.create, `${name} is not a rule`)
})

test("parameters use named object types", () => {
  tester.run("no-inline-parameter-type", noInlineParameterType, {
    valid: ["const read = (props: RowProps) => props", "const read = (value: string) => value"],
    invalid: [{ code: "const Row = (props: { label: string }) => props.label", errors: [{ messageId: "inline" }] }],
  })
})

test("exported React components use one props parameter with the matching type", () => {
  tester.run("public-component-signature", publicComponentSignature, {
    valid: [
      { filename: COMPONENT, code: "export const SurfaceCard = (props: SurfaceCardProps) => <div>{props.children}</div>" },
      { filename: COMPONENT, code: "export const SurfaceCardBase = (props: SurfaceCardProps) => <div>{props.children}</div>" },
      { filename: COMPONENT, code: "export const RankMarkIconId = (rank: number) => rank > 0 ? 'up' : 'down'" },
      { filename: COMPONENT, code: "export const GenericCard = <T,>(props: GenericCardProps<T>) => <div>{props.value}</div>" },
      { filename: "/repo/src/components/branches/SurfaceCard/component.test.tsx", code: "export const SurfaceCard = () => <div />" },
    ],
    invalid: [
      { filename: COMPONENT, code: "export const SurfaceCard = ({ children }: SurfaceCardProps) => <div>{children}</div>", errors: [{ messageId: "parameter" }] },
      { filename: COMPONENT, code: "export const SurfaceCard = (input: SurfaceCardProps) => <div>{input.children}</div>", errors: [{ messageId: "parameter" }] },
      { filename: COMPONENT, code: "export const SurfaceCard = () => <div />", errors: [{ messageId: "parameter" }] },
      { filename: COMPONENT, code: "export const SurfaceCard = (props: OtherProps) => <div>{props.children}</div>", errors: [{ messageId: "type" }] },
      { filename: COMPONENT, code: "export const SurfaceCardBase = (props: SurfaceCardBaseProps) => <div>{props.children}</div>", errors: [{ messageId: "type" }] },
      { filename: COMPONENT, code: "export function SurfaceCard(props: SurfaceCardProps) { return <div>{props.children}</div> }", errors: [{ messageId: "parameter" }] },
    ],
  })
})

test("ordinary children are allowed in component props", () => {
  tester.run("public-component-signature", publicComponentSignature, {
    valid: [{ filename: COMPONENT, code: "export const ModalBranch = (props: ModalBranchProps) => <section>{props.children}</section>" }],
    invalid: [],
  })
})

test("styling ownership rules keep internal CSS doors closed", () => {
  tester.run("no-per-part-classname-prop", noPerPartClassNameProp, {
    valid: [{ filename: COMPONENT, code: "type Props = { tone: 'quiet' | 'loud' }" }],
    invalid: [{ filename: COMPONENT, code: "type Props = { titleClassName?: string }", errors: [{ messageId: "perPart" }] }],
  })
  tester.run("no-public-classname-prop", noPublicClassNameProp, {
    valid: [{ filename: COMPONENT, code: "type Props = { tone: 'quiet' | 'loud' }" }],
    invalid: [{ filename: COMPONENT, code: "type Props = { className?: string }", errors: [{ messageId: "declaration" }] }],
  })
  tester.run("no-public-frame-css-props", noPublicFrameCssProps, {
    valid: [{ filename: "/repo/src/components/leaves/Stack/index.tsx", code: "type Props = { gap?: string }" }],
    invalid: [{ filename: COMPONENT, code: "type Props = { gap?: string }", errors: [{ messageId: "css" }] }],
  })
  tester.run("no-css-door-type-laundering", noCssDoorTypeLaundering, {
    valid: [{ filename: COMPONENT, code: "type Props = Pick<Base, 'tone'>" }],
    invalid: [{ filename: COMPONENT, code: "type Props = Omit<Base, 'className'>", errors: [{ messageId: "utility" }] }],
  })
})
