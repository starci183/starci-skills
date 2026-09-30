/** Focused tests for named React props and component-owned styling. */
import assert from "node:assert/strict"
import test from "node:test"
import { at, slotTester, typedTester } from "./fixtures/typed/tester.mjs"
import {
  noCssDoorTypeLaundering,
  noInlineParameterType,
  noPerPartClassNameProp,
  noPublicClassNameProp,
  noPublicFrameCssProps,
  publicComponentSignature,
  rules,
} from "./props-and-slots.mjs"

const tester = slotTester()
const typed = typedTester()
const COMPONENT = at("apps/web/src/components/branches/SurfaceCard/index.tsx")
const PACKAGE_BRANCH = at("packages/nivo-ui/src/branches/SurfaceCard/index.tsx")
const NOT_A_COMPONENT = at("apps/web/src/modules/components/SurfaceCard.tsx")
const FEED = at("apps/web/src/components/blocks/Feed/index.tsx")

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
      { filename: COMPONENT, code: "export const SurfaceCardBase = (props: SurfaceCardBaseProps) => <div>{props.children}</div>" },
      { filename: COMPONENT, code: "export const RankMarkIconId = (rank: number) => rank > 0 ? 'up' : 'down'" },
      // a folder named components inside a module is no component owner; a package branch is one
      { filename: NOT_A_COMPONENT, code: "export const SurfaceCard = ({ children }: SurfaceCardProps) => <div>{children}</div>" },
      { filename: COMPONENT, code: "export const GenericCard = <T,>(props: GenericCardProps<T>) => <div>{props.value}</div>" },
    ],
    invalid: [
      { filename: COMPONENT, code: "export const SurfaceCard = ({ children }: SurfaceCardProps) => <div>{children}</div>", errors: [{ messageId: "parameter" }] },
      { filename: COMPONENT, code: "export const SurfaceCard = (input: SurfaceCardProps) => <div>{input.children}</div>", errors: [{ messageId: "parameter" }] },
      { filename: COMPONENT, code: "export const SurfaceCard = () => <div />", errors: [{ messageId: "parameter" }] },
      { filename: COMPONENT, code: "export const SurfaceCard = (props: OtherProps) => <div>{props.children}</div>", errors: [{ messageId: "type" }] },
      { filename: COMPONENT, code: "export const SurfaceCardBase = (props: OtherProps) => <div>{props.children}</div>", errors: [{ messageId: "type" }] },
      { filename: PACKAGE_BRANCH, code: "export const SurfaceCard = () => <div />", errors: [{ messageId: "parameter" }] },
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
    valid: [{ filename: COMPONENT, code: "type Props = { tone: 'quiet' | 'loud' }" }, { filename: NOT_A_COMPONENT, code: "type Props = { titleClassName?: string }" }],
    invalid: [{ filename: PACKAGE_BRANCH, code: "type Props = { titleClassName?: string }", errors: [{ messageId: "perPart" }] }, { filename: COMPONENT, code: "type Props = { titleClassName?: string }", errors: [{ messageId: "perPart" }] }],
  })
  typed.run("no-public-classname-prop", noPublicClassNameProp, {
    valid: [
      { filename: COMPONENT, code: "type Props = { tone: 'quiet' | 'loud' }" },
      { filename: NOT_A_COMPONENT, code: "type Props = { className?: string }" },
      // a widget of a module is not a house component: its owner is no component layer
      { filename: FEED, code: "import { Widget } from \"../../../modules/widgets/Widget\"\nexport const C = () => <Widget className=\"x\" />" },
      { filename: FEED, code: "import { Badge } from \"../../leaves/Badge\"\nexport const C = () => <Badge>x</Badge>" },
    ],
    invalid: [
      { filename: COMPONENT, code: "type Props = { className?: string }", errors: [{ messageId: "declaration" }] },
      { filename: PACKAGE_BRANCH, code: "type Props = { classNames?: string }", errors: [{ messageId: "declaration" }] },
      { filename: FEED, code: "import { Badge } from \"../../leaves/Badge\"\nexport const C = () => <Badge className=\"x\" />", errors: [{ messageId: "usage" }] },
    ],
  })
  tester.run("no-public-frame-css-props", noPublicFrameCssProps, {
    valid: [
      { filename: at("apps/web/src/components/leaves/Stack/index.tsx"), code: "type Props = { gap?: string }" },
      { filename: at("packages/nivo-ui/src/leaves/Stack/index.tsx"), code: "type Props = { gap?: string }" },
      { filename: NOT_A_COMPONENT, code: "type Props = { gap?: string }" },
    ],
    invalid: [{ filename: PACKAGE_BRANCH, code: "type Props = { gap?: string }", errors: [{ messageId: "css" }] }, { filename: COMPONENT, code: "type Props = { gap?: string }", errors: [{ messageId: "css" }] }],
  })
  tester.run("no-css-door-type-laundering", noCssDoorTypeLaundering, {
    valid: [
      { filename: COMPONENT, code: "type Props = Pick<Base, 'tone'>" },
    ],
    invalid: [{ filename: at("apps/web/src/hooks/lesson/useLesson.ts"), code: "type Props = Omit<Base, 'style'>", errors: [{ messageId: "utility" }] }, { filename: COMPONENT, code: "type Props = Omit<Base, 'className'>", errors: [{ messageId: "utility" }] }],
  })
})
