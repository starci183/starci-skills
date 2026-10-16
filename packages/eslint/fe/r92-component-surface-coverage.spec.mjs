import test from "node:test"
import { typedTester, at } from "./fixtures/typed/tester.mjs"
import { rules as props } from "./props-and-slots.mjs"
import { rules as drawing } from "./drawing.mjs"
import { rules as split } from "./the-split.mjs"
import { rules as loading } from "./loading.mjs"
import { rules as classes } from "./class-names.mjs"

// proves: FE_COMPONENT_API@lite FE_COMPONENT_API@full
// proves: FE_PURE_REACHES_DATA@lite FE_PURE_REACHES_DATA@full
// proves: FE_CONNECTED_BLOCK_RENDER_PAIR@lite FE_CONNECTED_BLOCK_RENDER_PAIR@full
const COMPONENT = at("apps/web/src/components/branches/SurfaceCard/index.tsx")
const BLOCK = at("apps/web/src/components/blocks/sales/HandoffBlock/component.tsx")
const INDEX = at("apps/web/src/components/blocks/sales/HandoffBlock/index.tsx")
const STYLES = at("apps/web/src/components/leaves/Badge/classNames.ts")
const LEAF = at("apps/web/src/components/leaves/Badge/index.tsx")
for (const edition of ["lite", "full"]) {
  test(`R92 ${edition} accepts canon component surfaces and rejects forbidden props, styling and data reads`, () => {
    const tester = typedTester({ lite: edition === "lite" })
    tester.run("no-inline-parameter-type", props["no-inline-parameter-type"], {
      valid: [{ code: "const read = (props: P) => props" }],
      invalid: [{ code: "const read = (props: {label: string}) => props.label", errors: [{messageId: "inline"}] }],
    })
    tester.run("public-component-signature", props["public-component-signature"], {
      valid: [{filename: COMPONENT, code: "export const SurfaceCard = (props: SurfaceCardProps) => <div>{props.children}</div>"}],
      invalid: [{filename: COMPONENT, code: "export const SurfaceCard = ({children}: SurfaceCardProps) => <div>{children}</div>", errors: [{messageId: "parameter"}]}],
    })
    tester.run("no-per-part-classname-prop", props["no-per-part-classname-prop"], {
      valid: [{filename: COMPONENT, code: "type Props = {tone: string}"}],
      invalid: [{filename: COMPONENT, code: "type Props = {titleClassName?: string}", errors: [{messageId: "perPart"}]}],
    })
    tester.run("no-public-classname-prop", props["no-public-classname-prop"], {
      valid: [{filename: COMPONENT, code: "type Props = {tone: string}"}],
      invalid: [{filename: COMPONENT, code: "type Props = {className?: string}", errors: [{messageId: "declaration"}]}],
    })
    tester.run("no-public-frame-css-props", props["no-public-frame-css-props"], {
      valid: [{filename: COMPONENT, code: "type Props = {tone: string}"}],
      invalid: [{filename: COMPONENT, code: "type Props = {gap?: string}", errors: [{messageId: "css"}]}],
    })
    tester.run("no-css-door-type-laundering", props["no-css-door-type-laundering"], {
      valid: [{filename: COMPONENT, code: "type Props = Pick<Base, 'tone'>"}],
      invalid: [{filename: COMPONENT, code: "type Props = Omit<Base, 'className'>", errors: [{messageId: "utility"}]}],
    })
    tester.run("base-props-atom", drawing["base-props-atom"], {
      valid: [{filename: BLOCK, code: 'export type HandoffBlockBaseProps = { readonly state: "sent"; readonly props: {readonly id: string}; readonly on: {readonly retry: () => void} }; export const HandoffBlockBase = (props: HandoffBlockBaseProps) => <div />;'}],
      invalid: [{filename: BLOCK, code: 'export const HandoffBlockBase = (props: {label: string}) => <div />', errors: [{messageId: "member"}]}],
    })
    tester.run("base-import-pair", drawing["base-import-pair"], {
      valid: [{filename: INDEX, code: 'import { HandoffBlockBase } from "./component"'}],
      invalid: [{filename: INDEX, code: 'export { HandoffBlockBase } from "./component"', errors: [{messageId: "reexport"}]}],
    })
    tester.run("no-data-status-shape", drawing["no-data-status-shape"], {
      valid: [{filename: BLOCK, code: 'export type HandoffBlockState = "sent" | "returned"'}],
      invalid: [{filename: BLOCK, code: 'export type HandoffBlockState = "pending"', errors: [{messageId: "status"}]}],
    })
    tester.run("slot-status-through-slotview", drawing["slot-status-through-slotview"], {
      valid: [{filename: BLOCK, code: 'export const X = (props: P) => <SlotView slot={props.props.order}>{(o) => <p>{o.code}</p>}</SlotView>'}],
      invalid: [{filename: BLOCK, code: 'export const X = (props: P) => (props.props.isLoading ? <Spinner /> : <p />)', errors: [{messageId: "branch"}]}],
    })
    tester.run("presentational-purity", split["presentational-purity"], {
      valid: [{filename: BLOCK, code: 'export const X = (props: P) => <div>{props.label}</div>'}],
      invalid: [{filename: BLOCK, code: 'const value = useTranslations("quest")', errors: [{messageId: "reaches"}]}],
    })
    tester.run("connected-block-has-presentational-twin", split["connected-block-has-presentational-twin"], {
      valid: [{filename: INDEX, code: 'import { useTranslations } from "next-intl"; import { HandoffBlockBase } from "./component"; export const HandoffBlock = () => <HandoffBlockBase props={{label: useTranslations("q")("l")}} />'}],
      invalid: [{filename: INDEX, code: 'import { useTranslations } from "next-intl"; export const HandoffBlock = () => <div>{useTranslations("q")("l")}</div>', errors: [{messageId: "missing"}]}],
    })
    tester.run("no-resting-twin-component", loading["no-resting-twin-component"], {
      valid: [{filename: INDEX, code: 'export const HandoffBlock = () => null'}],
      invalid: [{filename: at("apps/web/src/components/blocks/HandoffSkeleton/index.tsx"), code: 'export const HandoffSkeleton = () => null', errors: [{messageId: "twin"}]}],
    })
    tester.run("no-placeholder-prop", loading["no-placeholder-prop"], {
      valid: [{filename: BLOCK, code: 'const X = () => <Card isLoading={pending} />'}],
      invalid: [{filename: BLOCK, code: 'const X = () => <Card skeleton={<Rows />} />', errors: [{messageId: "prop"}]}],
    })
    tester.run("no-resting-branch-at-call-site", loading["no-resting-branch-at-call-site"], {
      valid: [{filename: BLOCK, code: 'const X = () => isLoading ? <Row props={a} /> : <Row props={b} />'}],
      invalid: [{filename: BLOCK, code: 'const X = () => isLoading ? <RowSkeleton /> : <Row props={b} />', errors: [{messageId: "branch"}]}],
    })
    tester.run("no-inline-class-name", classes["no-inline-class-name"], {
      valid: [{filename: LEAF, code: 'import { badgeClassName } from "./classNames"; const X = () => <div className={badgeClassName} />'}],
      invalid: [{filename: LEAF, code: 'const X = () => <div className="flex" />', errors: [{messageId: "inline"}]}],
    })
    tester.run("class-names-in-colocated-file", classes["class-names-in-colocated-file"], {
      valid: [{filename: STYLES, code: 'export const badgeClassName = cn("flex")'}],
      invalid: [{filename: LEAF, code: 'const badgeClassName = cn("flex")', errors: [{messageId: "misplaced"}]}],
    })
    tester.run("cn-arguments-are-single-tokens", classes["cn-arguments-are-single-tokens"], {
      valid: [{filename: STYLES, code: 'export const badgeClassName = cn("flex", "gap-2")'}],
      invalid: [{filename: STYLES, code: 'export const badgeClassName = cn("flex gap-2")', errors: [{messageId: "token"}]}],
    })
  })
}
