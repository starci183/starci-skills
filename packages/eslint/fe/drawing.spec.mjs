/**
 * Twin tests for the drawing law.
 *
 *   node --test drawing.spec.mjs
 *
 * The scope is the pure half of a split tier. The cases that matter sit just outside it: the
 * connected half and the recipe composite are SUPPOSED to read status flags, and a layout alone
 * may take the router's children.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, slotTester } from "./fixtures/typed/tester.mjs"
import {
  baseImportPair,
  basePropsAtom,
  noDataStatusShape,
  rules,
  slotStatusThroughSlotView,
} from "./drawing.mjs"

const tester = slotTester()

const BLOCK = at("apps/web/src/components/blocks/sales/HandoffBlock/component.tsx")
const BLOCK_INDEX = at("apps/web/src/components/blocks/sales/HandoffBlock/index.tsx")
const LAYOUT = at("apps/web/src/features/layouts/WorkspaceLayout/component.tsx")
const PAGE = at("apps/web/src/features/pages/OperatePage/component.tsx")
const OVERLAY = at("apps/web/src/features/overlays/sales/SendOverlay/component.tsx")
const FEATURE_PAGE = PAGE
const COMPOSITE = at("apps/web/src/components/composites/SlotView/index.tsx")

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.equal(typeof rule.create, "function", name)
    assert.ok(rule.meta?.docs?.description, name)
  }
})

test("a pure half takes state, atom props and on actions", () => {
  tester.run("base-props-atom", basePropsAtom, {
    valid: [
      {
        filename: BLOCK,
        code: `
          type HandoffBlockData = { readonly order: Slot<Order>; readonly labels: { readonly send: string }; readonly ids: ReadonlyArray<string> }
          type HandoffBlockActions = { readonly requestSend: (input: { fingerprint: string; revision: number }) => void; readonly retry: () => void }
          export type HandoffBlockBaseProps = { readonly state: "prepared" | "sent"; readonly props: HandoffBlockData; readonly on: HandoffBlockActions }
          export const HandoffBlockBase = (props: HandoffBlockBaseProps) => <div />`,
      },
      {
        filename: LAYOUT,
        code: `
          export type WorkspaceLayoutBaseProps = { readonly state: "sidebar"; readonly props: { readonly workspaceId: string }; readonly children: ReactNode }
          export const WorkspaceLayoutBase = (props: WorkspaceLayoutBaseProps) => <div>{props.children}</div>`,
      },
      {
        filename: COMPOSITE,
        code: "export const SlotView = (props: { children: (data: string) => ReactNode }) => <div />",
      },
      // a `component.tsx` that no split tier owns is not a pure half: a shared-package leaf and a folder named like a tier
      {
        filename: at("packages/nivo-ui/src/leaves/Badge/component.tsx"),
        code: "export type BadgeBaseProps = { readonly state: \"a\"; readonly props: { readonly icon: ReactNode }; readonly on: {} }",
      },
      {
        filename: at("apps/web/src/modules/components/blocks/Card/component.tsx"),
        code: "export type CardBaseProps = { readonly state: \"a\"; readonly props: { readonly icon: ReactNode }; readonly on: {} }",
      },
    ],
    invalid: [
      {
        filename: PAGE,
        code: `
          type OperatePageData = { readonly main: ReactNode }
          export const OperatePageBase = (props: { state: "view"; props: OperatePageData; on: {} }) => <div />`,
        errors: [{ messageId: "tree" }],
      },
      {
        filename: OVERLAY,
        code: "export const SendOverlayBase = (props: { state: \"form\"; props: {}; chat: ComponentType }) => <div />",
        errors: [{ messageId: "member" }],
      },
      {
        filename: BLOCK,
        code: "export const HandoffBlockBase = (props: { state: \"prepared\"; props: { readonly onSend: () => void }; on: {} }) => <div />",
        errors: [{ messageId: "action" }],
      },
      {
        filename: BLOCK,
        code: "export const HandoffBlockBase = (props: { state: \"prepared\"; props: {}; on: { readonly title: string } }) => <div />",
        errors: [{ messageId: "onData" }],
      },
      {
        filename: BLOCK,
        code: "export const HandoffBlockBase = (props: { state: \"prepared\"; props: {}; on: {}; children: ReactNode }) => <div />",
        errors: [{ messageId: "member" }],
      },
      {
        filename: BLOCK,
        code: "export const HandoffBlockBase = (props: { state: \"prepared\"; props: {}; on: { readonly render: (node: JSX.Element) => void } }) => <div />",
        errors: [{ messageId: "tree" }],
      },
    ],
  })
})

test("only the sibling index reaches the pure half, and it never re-exports XBase", () => {
  tester.run("base-import-pair", baseImportPair, {
    valid: [
      { filename: BLOCK_INDEX, code: "import { HandoffBlockBase } from \"./component\"" },
      { filename: BLOCK_INDEX, code: "export type { HandoffBlockState } from \"./component\"" },
      { filename: PAGE, code: "import { HandoffBlock } from \"@/components/blocks/sales/HandoffBlock\"" },
      // a sibling `./component` outside a split tier is an ordinary module
      { filename: at("apps/web/src/modules/utils/index.ts"), code: "import { x } from \"./component\"" },
      { filename: at("apps/web/src/modules/components/blocks/Card/index.tsx"), code: "import { CardBase } from \"./component\"; export { CardBase }" },
    ],
    invalid: [
      { filename: PAGE, code: "import { HandoffBlockBase } from \"@/components/blocks/sales/HandoffBlock/component\"", errors: [{ messageId: "reach" }] },
      { filename: LAYOUT, code: "import { X } from \"../../../components/blocks/Y/component\"", errors: [{ messageId: "reach" }] },
      { filename: BLOCK_INDEX, code: "export { HandoffBlockBase } from \"./component\"", errors: [{ messageId: "reexport" }] },
    ],
  })
})

test("a shape union never lists a data status or open/closed", () => {
  tester.run("no-data-status-shape", noDataStatusShape, {
    valid: [
      { filename: BLOCK, code: "export type HandoffBlockState = \"prepared\" | \"sent\" | \"returned\"" },
      { filename: OVERLAY, code: "export type SendOverlayState = \"form\" | \"confirm\"" },
      { filename: BLOCK_INDEX, code: "export type HandoffBlockState = \"pending\" | \"ready\"" },
      // a `component.tsx` outside every split tier names no drawn shapes
      { filename: at("packages/nivo-ui/src/leaves/Badge/component.tsx"), code: "export type BadgeState = \"pending\" | \"ready\"" },
      { filename: at("apps/web/src/modules/components/blocks/Card/component.tsx"), code: "export type CardState = \"pending\"" },
    ],
    invalid: [
      { filename: BLOCK, code: "export type ExampleBlockState = \"pending\" | \"ready\" | \"failed\"", errors: [{ messageId: "status" }, { messageId: "status" }] },
      { filename: OVERLAY, code: "export type DrawerState = \"closed\" | \"ready\"", errors: [{ messageId: "status" }] },
      { filename: FEATURE_PAGE, code: "export type OperatePageState = \"view\" | \"loading\"", errors: [{ messageId: "status" }] },
    ],
  })
})

test("a block's pure half renders data status only through SlotView", () => {
  tester.run("slot-status-through-slotview", slotStatusThroughSlotView, {
    valid: [
      { filename: BLOCK, code: "export const X = (props: P) => <SlotView slot={props.props.order}>{(o) => <p>{o.code}</p>}</SlotView>" },
      { filename: BLOCK, code: "export const X = (props: P) => (props.state === \"sent\" ? <p /> : null)" },
      { filename: COMPOSITE, code: "export const SlotView = (props: P) => (props.slot.isLoading ? <p /> : null)" },
      // a shared-package drawing half is not a block's pure half
      { filename: at("packages/nivo-ui/src/leaves/Badge/component.tsx"), code: "export const X = (props: P) => (props.props.isLoading ? <Spinner /> : <p />)" },
      { filename: BLOCK_INDEX, code: "const state = query.isLoading ? \"a\" : \"b\"" },
    ],
    invalid: [
      { filename: BLOCK, code: "export const X = (props: P) => (props.props.isLoading ? <Spinner /> : <p />)", errors: [{ messageId: "branch" }] },
      { filename: BLOCK, code: "export const X = (props: P) => <div>{props.props.order.isError && <p />}</div>", errors: [{ messageId: "branch" }] },
      { filename: BLOCK, code: "const f = (s) => { if (s.isForbidden) return null; return 1 }", errors: [{ messageId: "branch" }] },
    ],
  })
})
