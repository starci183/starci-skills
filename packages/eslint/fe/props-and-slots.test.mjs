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
  propsFieldsReadonly,
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
      // a component with no input declares no parameter; `void props` is not required
      { filename: COMPONENT, code: "export const EmptyCard = () => <div />" },
      { filename: PACKAGE_BRANCH, code: "export const EmptyCard = () => <div />" },
      { filename: COMPONENT, code: "export const GenericCard = <T,>(props: GenericCardProps<T>) => <div>{props.value}</div>" },
    ],
    invalid: [
      { filename: COMPONENT, code: "export const SurfaceCard = ({ children }: SurfaceCardProps) => <div>{children}</div>", errors: [{ messageId: "parameter" }] },
      { filename: COMPONENT, code: "export const SurfaceCard = (input: SurfaceCardProps) => <div>{input.children}</div>", errors: [{ messageId: "parameter" }] },
      { filename: COMPONENT, code: "export const SurfaceCard = (_input: SurfaceCardProps, other: number) => <div />", errors: [{ messageId: "parameter" }] },
      { filename: COMPONENT, code: "export const SurfaceCard = (props: OtherProps) => <div>{props.children}</div>", errors: [{ messageId: "type" }] },
      { filename: COMPONENT, code: "export const SurfaceCardBase = (props: OtherProps) => <div>{props.children}</div>", errors: [{ messageId: "type" }] },
      { filename: PACKAGE_BRANCH, code: "export const SurfaceCard = (props: SurfaceCardProps, extra: number) => <div />", errors: [{ messageId: "parameter" }] },
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

test("props are readonly all the way down: fields, index signatures, nested objects and collections (R110, FE-TYPING-2)", () => {
  tester.run("props-fields-readonly", propsFieldsReadonly, {
    valid: [
      { filename: COMPONENT, code: "interface SurfaceCardProps { readonly title: string; readonly tags: readonly string[]; readonly pair: readonly [string, number]; readonly rows: ReadonlyArray<{ readonly id: string }>; readonly onSelect: () => void; readonly [key: string]: unknown }\nexport const SurfaceCard = (props: SurfaceCardProps) => <div>{props.title}</div>" },
      // an inherited local shape is judged too, and passes when readonly
      { filename: COMPONENT, code: "interface Base { readonly id: string }\nexport interface SurfaceCardProps extends Base { readonly title: string }\nexport const SurfaceCard = (props: SurfaceCardProps) => <div>{props.title}</div>" },
      // Readonly<T> makes the top level readonly
      { filename: COMPONENT, code: "type SurfaceCardProps = Readonly<{ title: string; tags: readonly string[] }>\nexport const SurfaceCard = (props: SurfaceCardProps) => <div>{props.title}</div>" },
      // a method signature is not a field; an imported shape is judged in the file that declares it
      { filename: COMPONENT, code: "import type { Row } from './row'\ninterface SurfaceCardProps { readonly row: Row; select(): void }\nexport const SurfaceCard = (props: SurfaceCardProps) => <div>{props.row}</div>" },
      // a function that renders nothing is not a component; an un-exported helper is local
      { filename: COMPONENT, code: "interface Input { title: string }\nexport const label = (input: Input) => input.title" },
      { filename: COMPONENT, code: "interface Cell { title: string }\nconst renderCell = (cell: Cell) => <li>{cell.title}</li>\nexport const SurfaceCard = (props: { readonly titles: readonly string[] }) => <ul>{props.titles.map((title) => renderCell({ title }))}</ul>" },
      // outside product source the rule does not apply
      { filename: at("scripts/build.tsx"), code: "interface P { title: string }\nexport const X = (props: P) => <div>{props.title}</div>" },
    ],
    invalid: [
      { filename: COMPONENT, code: "interface SurfaceCardProps { title: string }\nexport const SurfaceCard = (props: SurfaceCardProps) => <div>{props.title}</div>", errors: [{ messageId: "field" }] },
      { filename: COMPONENT, code: "interface SurfaceCardProps { readonly tags: string[]; readonly pair: [string, number]; readonly rows: Array<string> }\nexport const SurfaceCard = (props: SurfaceCardProps) => <div>{props.tags}</div>", errors: [{ messageId: "collection" }, { messageId: "collection" }, { messageId: "collection" }] },
      { filename: COMPONENT, code: "interface SurfaceCardProps { readonly meta: { label: string }; [key: string]: unknown }\nexport const SurfaceCard = (props: SurfaceCardProps) => <div>{props.meta.label}</div>", errors: [{ messageId: "field" }, { messageId: "index" }] },
      // an inherited mutable field and a nested element shape are found at their declaration
      { filename: COMPONENT, code: "interface Base { id: string }\ninterface Item { name: string }\ninterface SurfaceCardProps extends Base { readonly items: readonly Item[] }\nexport function SurfaceCard(props: SurfaceCardProps) { return <div>{props.id}</div> }", errors: [{ messageId: "field" }, { messageId: "field" }] },
      { filename: COMPONENT, code: "type SurfaceCardProps = { readonly title: string } & { open: boolean }\nexport default function SurfaceCard(props: SurfaceCardProps) { return <div>{props.title}</div> }", errors: [{ messageId: "field" }] },
    ],
  })
})
