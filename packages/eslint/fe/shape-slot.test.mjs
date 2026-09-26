/**
 * Twin tests for the shape-slot law.
 *
 *   node --test shape-slot.test.mjs
 *
 * The scope is the pure half of a split tier. The cases that matter sit just outside it: the
 * connected half and the recipe composite are SUPPOSED to read status flags, and a layout alone
 * may take the router's children.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  baseImportPair,
  basePropsAtom,
  noDataStatusShape,
  rules,
  slotStatusThroughSlotView,
} from "./shape-slot.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const BLOCK = "D:/repo/src/components/blocks/sales/HandoffBlock/component.tsx"
const BLOCK_INDEX = "D:/repo/src/components/blocks/sales/HandoffBlock/index.tsx"
const BLOCK_SPEC = "D:/repo/src/components/blocks/sales/HandoffBlock/component.spec.tsx"
const LAYOUT = "D:/repo/src/components/layouts/WorkspaceLayout/component.tsx"
const PAGE = "D:/repo/src/components/pages/OperatePage/component.tsx"
const OVERLAY = "D:/repo/src/components/overlays/sales/SendOverlay/component.tsx"
const FEATURE_PAGE = "D:/repo/src/features/pages/OperatePage/component.tsx"
const COMPOSITE = "D:/repo/src/components/composites/SlotView/index.tsx"

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
      { filename: BLOCK_SPEC, code: "import { HandoffBlockBase } from \"./component\"" },
      { filename: BLOCK_INDEX, code: "export type { HandoffBlockState } from \"./component\"" },
      { filename: PAGE, code: "import { HandoffBlock } from \"@/components/blocks/sales/HandoffBlock\"" },
    ],
    invalid: [
      { filename: PAGE, code: "import { HandoffBlockBase } from \"@/components/blocks/sales/HandoffBlock/component\"", errors: [{ messageId: "reach" }] },
      { filename: LAYOUT, code: "import { X } from \"../../blocks/Y/component\"", errors: [{ messageId: "reach" }] },
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
      { filename: BLOCK_INDEX, code: "const state = query.isLoading ? \"a\" : \"b\"" },
    ],
    invalid: [
      { filename: BLOCK, code: "export const X = (props: P) => (props.props.isLoading ? <Spinner /> : <p />)", errors: [{ messageId: "branch" }] },
      { filename: BLOCK, code: "export const X = (props: P) => <div>{props.props.order.isError && <p />}</div>", errors: [{ messageId: "branch" }] },
      { filename: BLOCK, code: "const f = (s) => { if (s.isForbidden) return null; return 1 }", errors: [{ messageId: "branch" }] },
    ],
  })
})
