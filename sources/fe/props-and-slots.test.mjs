/**
 * Twin tests for the props-and-slots rule.
 *
 *   node --test props-and-slots.test.mjs
 *
 * The valid cases carry the weight here. This rule fires on ONE shape - an object pattern with an
 * inline type - and a version that widened to "any parameter with a type" would fire on every
 * ordinary function in the tree, which is how a rule earns a blanket disable comment.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  noChildrenSlot,
  noInlineParameterType,
  noSurfaceListItemsSlot,
  rules,
} from "./props-and-slots.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("SLOTS-3: a parameter's complete shape is named in the module", () => {
  tester.run("no-inline-parameter-type", noInlineParameterType, {
    valid: [
      "export const Row = ({ props }: RowProps) => null",
      "export const Row = ({ props }: LeafProps<RowData>) => null",
      // untyped destructuring is a different question, and not this rule's
      "const f = ({ a }) => a",
      // a named scalar parameter is not a shape with nowhere to be read from
      "const f = (value: string) => value",
      "const f = (input: RowProps) => input.props",
    ],
    invalid: [
      {
        code: "export const Row = ({ props }: { props: { label: string } }) => null",
        errors: [{ messageId: "inline" }],
      },
      {
        code: "const f = function ({ a }: { a: string }) { return a }",
        errors: [{ messageId: "inline" }],
      },
      {
        // parentheses do not hide it
        code: "const f = ({ a }: ({ a: string })) => a",
        errors: [{ messageId: "inline" }],
      },
      {
        code: "const C = (input: DashboardFrame & { readonly signOutLabel: string }) => input",
        errors: [{ messageId: "inline" }],
      },
      {
        code: "const C = ({ props }: DashboardFrame & { readonly props: Copy }) => props",
        errors: [{ messageId: "inline" }],
      },
      {
        code: "const f = (input: { a: string }) => input.a",
        errors: [{ messageId: "inline" }],
      },
    ],
  })
})

const BRANCH = "/repo/src/components/branches/SurfaceCard/index.tsx"
const SHELL = "/repo/src/components/shells/ModalShell/index.tsx"
const FAKE_SHELL = "/repo/src/components/shells/PopoverShell/index.tsx"

test("SLOTS-4: containers take contract and render; only the three closed shells take children", () => {
  tester.run("no-children-slot", noChildrenSlot, {
    valid: [
      // the shape this rule exists to push people towards
      { filename: BRANCH, code: "export interface P { contract: ContractKey; render: ChildrenOf<K> }" },
      { filename: BRANCH, code: "export const S = ({ props, render }: SProps) => null" },
      // the one lawful home for the slot: the vendor declares it, the wrapper cannot refuse it
      { filename: SHELL, code: "export interface P { children?: ReactNode }" },
      { filename: SHELL, code: "export const M = ({ children }: MProps) => null" },
      { filename: "/repo/src/components/shells/DropdownShell/index.tsx", code: "type DropdownShellProps = { children?: ReactNode }" },
      // outside the component tree entirely - a page or a test may say what it likes
      { filename: "/repo/src/app/page.tsx", code: "export const P = ({ children }: PProps) => null" },
      // an ordinary object property that happens to be called children is not a slot
      { filename: BRANCH, code: "const spec = { children: [] }" },
    ],
    invalid: [
      {
        filename: FAKE_SHELL,
        code: "type PopoverShellProps = { readonly children?: ReactNode }",
        errors: [{ messageId: "slot" }],
      },
      {
        filename: BRANCH,
        code: "export interface SProps { children?: ReactNode }",
        errors: [{ messageId: "slot" }],
      },
      {
        filename: BRANCH,
        code: "export const S = ({ props, children }: SProps) => null",
        errors: [{ messageId: "slot" }],
      },
      {
        // a leaf is below the container tier, so it may not grow one either
        filename: "/repo/src/components/leaves/Icon/index.tsx",
        code: "export const Icon = ({ children }: IconProps) => null",
        errors: [{ messageId: "slot" }],
      },
    ],
  })
})

test("SLOTS-7: list collections travel through named props, never an items lane", () => {
  tester.run("no-surface-list-items-slot", noSurfaceListItemsSlot, {
    valid: [
      {
        filename: "/repo/src/components/blocks/dashboard/DailyQuest/component.tsx",
        code: "import { SurfaceListCard } from '@/components/branches/SurfaceListCard'; export const C = () => <SurfaceListCard contract='daily-quest-list' render={Content} props={{ label, tasks }} />",
      },
    ],
    invalid: [
      {
        filename: "/repo/src/components/blocks/dashboard/DailyQuest/component.tsx",
        code: "import { SurfaceListCard as List } from '@/components/branches/SurfaceListCard'; export const C = () => <List contract='daily-quest-list' render={Content} props={{ label }} items={tasks} />",
        errors: [{ messageId: "items" }],
      },
    ],
  })
})

test("SLOTS-4: RouteShell may take the children the framework hands a layout", () => {
  tester.run("no-children-slot", rules["no-children-slot"], {
    valid: [
      {
        // The one seam between Next's contract and this house's: it converts and arranges nothing.
        filename: "/repo/src/components/shells/RouteShell/index.tsx",
        code: "export const RouteShell = ({ children, frame: Frame }) => <Frame surface={() => children} />",
      },
    ],
    invalid: [
      {
        // A connected layout is NOT the seam, however close it sits to one.
        filename: "/repo/src/components/layouts/LearnShellLayout/index.tsx",
        code: "export const L = ({ children }) => <div>{children}</div>",
        errors: 1,
      },
    ],
  })
})
