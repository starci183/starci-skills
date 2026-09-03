# Test

This file answers one question: given a frontend unit, where does its spec live, what does it
assert, and what does it leave alone?

Sources: `src/components/pages/CartPage/index.spec.tsx`,
`pages/CodingDomainPage/component.spec.tsx`, `blocks/commerce/CartBlock/index.spec.tsx`,
`hooks/index.ts`, `packages/grammar/src/**/*.spec.tsx`, `packages/grammar/src/**/*.test.mjs`,
`package.json` scripts (`vitest run`).

## FE-TEST-1 — Placement

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Pure half | `component.spec.tsx` beside `component.tsx` (55 blocks, 42 pages) |
| Case 2 | Connected half | `index.spec.tsx` beside `index.tsx` (61 blocks, 24 pages, 19 leaves) |
| Case 3 | Hook | `useQueryCourseSwr.spec.ts` beside the hook |
| Case 4 | Class strings | `classNames.spec.ts` beside `classNames.ts` (2 in blocks); Grammar CSS proof in `styles.spec.ts` (6) |
| Case 5 | Anywhere else | 0 of 497 specs live in a `__tests__/` folder |
| Case 6 | Runner | `vitest`, `@testing-library/react`; `describe/it/expect/vi` imported from `"vitest"` |

## FE-TEST-2 — Connected spec: mock the doors, assert the props handed down

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Hoisted mock state | `const mocks = vi.hoisted(() => ({ input: undefined as TestInput \| undefined, token: "token" as string \| undefined, cart: { data: undefined as unknown, error: undefined as unknown, isLoading: false, mutate: vi.fn() }, … }))` |
| Case 2 | The hooks barrel | `vi.mock("@/hooks", () => ({ useQueryMyCartSwr: () => mocks.cart, useQueryCoursesCheckoutPreviewSwr: () => mocks.preview, … }))` (25 of 61 block index specs) |
| Case 3 | Translation and routing | `vi.mock("next-intl", () => ({ useLocale: () => "en", useTranslations: () => (key: string) => key }))`, `vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))` |
| Case 4 | The pure twin | `vi.mock("./component", () => ({ CartBlockBase: (input: TestInput) => { mocks.input = input; return <output data-testid="cart" /> } }))` |
| Case 5 | Import after mocks | `import { CartBlock } from "./index"` placed after the `vi.mock` calls |
| Case 6 | Assertion | `expect(mocks.input?.blockState).toBe("empty")`, `act(() => { mocks.input?.on.pay() })`, `expect(mocks.checkout.trigger).toHaveBeenCalledWith(expect.objectContaining({ paymentType: "payos" }))` |
| Case 7 | Reset | `beforeEach(() => { vi.clearAllMocks(); mocks.input = undefined; … })` |

## FE-TEST-3 — Pure spec: render fixtures, assert what a reader would find

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Render | `render(<CodingDomainPageBase domain="arrays" navHome="Home" navPractice="Practice" title="Arrays" />)` |
| Case 2 | Landmarks and text | `expect(screen.getByRole("heading", { name: "Arrays" })).toBeInTheDocument()` (185 specs use `getByRole`, 173 `getByText`, 60 `getByTestId`) |
| Case 3 | Child owners stubbed | `vi.mock("@/components/blocks/coding/CodingDomainStanding", () => ({ CodingDomainStanding: () => <div data-testid="domain-standing" /> }))` then `expect(screen.getByTestId("domain-standing")).toBeInTheDocument()` |
| Case 4 | Page composes without owning | `it("composes the connected cart block without owning its state", () => { render(<CartPage />); expect(screen.getByTestId("cart-block")).toHaveTextContent("cart-block") })` |
| Case 5 | State inventory | pure specs iterate the exported `X_STATES` array to render every member |

## FE-TEST-4 — Names

| Case | When | Write |
| --- | --- | --- |
| Case 1 | `describe` | the export under test: `describe("CodingDomainPageBase"`, `describe("CartBlock"`, `describe("CartPage route"` (85 of 97 `component.spec` use the `…Base` name; 0 `index.spec` do) |
| Case 2 | `it` | a sentence about behaviour: `"keeps topic anatomy while composing connected standing and problem owners"`, `"maps cart states and dispatches browse, clear and checkout actions"` |

## FE-TEST-5 — Not asserted

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Snapshots | 0 `toMatchSnapshot` / `toMatchInlineSnapshot` in `src/` |
| Case 2 | Network | never reached; `@/hooks` is mocked wholesale, which is why the barrel exists |
| Case 3 | Translation content | `useTranslations: () => (key: string) => key` — a spec asserts keys, not copy |
| Case 4 | A literal class string in a component or index spec | Nothing. Assert the role, the text, or the prop handed down: 215 of 272 component specs carry no `toHaveClass` or `className` at all. A pinned literal duplicates the presentation authority in a second place, so a class that moves onto the closed scale turns a spec red for a correct change, and a class that is off the scale is locked in by the spec that pins it. Class proof has two homes of its own: `classNames.spec.ts` (2, 11 assertions) and Grammar `styles.spec.ts` (6). The 57 specs that pin one are the open question below, not a second practice |

## FE-TEST-6 — Grammar package

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Component behaviour | `index.spec.tsx` beside `index.tsx` (24) |
| Case 2 | Built output | `common/index.test.mjs`: `import test from "node:test"` … `assert.equal(COMMON_UI_RULE_IDS.length, 117)` against `../../dist/common/index.js` |
| Case 3 | Package surface | `package-boundary.test.mjs`: `assert.deepEqual(Object.keys(packageJson.peerDependencies).sort(), ["@heroui/react", "react"])` |
| Case 4 | Family-wide proof | `core/family.spec.tsx`, `core/surface-card-family.spec.tsx`, `core/scrollable-surfaces.spec.tsx` |

## FE-TEST-7 — Coverage is per half, and neither half's spec covers the other

A unit with two halves has two subjects. The connected spec mocks `./component` wholesale
(FE-TEST-2 Case 4) and the pure spec stubs its child owners (FE-TEST-3 Case 3), so each one is
deliberately blind to the other; a unit with one spec has one uncovered half rather than partial
coverage of two.

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A new block or page with both halves | Both `index.spec.tsx` and `component.spec.tsx`, beside the file each one measures (28 of 101 block folders and 22 of 49 page folders already carry both) |
| Case 2 | Judging whether the connected spec stands in for the pure one | It does not: `vi.mock("./component", () => ({ CartBlockBase: (input) => { mocks.input = input; return <output /> } }))` replaces the whole pure half, so nothing it renders was measured |
| Case 3 | Judging whether the pure spec stands in for the connected one | It does not: it renders fixtures and stubs child owners, so no hook, SWR key, translation lookup or action wiring was exercised |

Not this rule: a leaf, which has no `component.tsx` (FE-FOLDER-2 Case 4) and therefore one spec.

## Open questions

- 57 of 272 component and index specs contain `toHaveClass` or `className`, in 167 calls. The other
  215 assert roles, text and handed-down props only, and class proof has dedicated homes
  (`classNames.spec.ts`, `styles.spec.ts`). FE-TEST-5 Case 4 records the majority as the rule; the 57
  are a standing debt against it rather than a second practice, and this file does not say which of
  them to delete first.
- FE-TEST-7 Case 1 binds a new unit. It is not a census of the tree: 73 of 101 block folders and 27 of
  49 page folders carry one spec and not two, and no sweep of that backlog is legislated here.
