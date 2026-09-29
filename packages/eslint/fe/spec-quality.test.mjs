/**
 * Twin tests for the spec quality rules (HFS R67, and the real-catalogue half of R60).
 *
 *   node --test spec-quality.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  connectedSpecHasAxe,
  noBarrelSpec,
  noClassStringInSpec,
  noDoubleCastInSpec,
  noMockedTranslations,
  rules,
  specTestsItsNeighbour,
} from "./spec-quality.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const LEAF_SPEC = "D:/repo/src/components/leaves/Chip/Chip.test.tsx"
const BLOCK_SPEC = "D:/repo/src/components/blocks/Feed/index.test.tsx"
const PAGE_SPEC = "D:/repo/src/features/pages/Home/index.test.tsx"
const COMPONENT = "D:/repo/src/components/blocks/Feed/index.tsx"

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("SPEC-1: a spec never pins a class string", () => {
  tester.run("no-class-string-in-spec", noClassStringInSpec, {
    valid: [
      { filename: LEAF_SPEC, code: "expect(screen.getByRole(\"button\", { name: \"Save\" })).toBeEnabled()" },
      { filename: LEAF_SPEC, code: "expect(el).toHaveAttribute(\"aria-pressed\", \"true\")" },
      { filename: LEAF_SPEC, code: "const n = container.querySelector(\"[data-part='date']\")" },
      { filename: LEAF_SPEC, code: "const n = container.querySelector(\"button\")" },
      // production source may use a class name freely
      { filename: COMPONENT, code: "const c = el.className" },
    ],
    invalid: [
      { filename: LEAF_SPEC, code: "expect(el).toHaveClass(\"bg-primary\")", errors: [{ messageId: "pinned" }] },
      { filename: LEAF_SPEC, code: "expect(el).toHaveAttribute(\"class\", \"a b\")", errors: [{ messageId: "pinned" }] },
      { filename: LEAF_SPEC, code: "expect(el.className).toContain(\"a\")", errors: [{ messageId: "pinned" }] },
      { filename: LEAF_SPEC, code: "expect(el.classList.contains(\"a\")).toBe(true)", errors: [{ messageId: "pinned" }] },
      { filename: LEAF_SPEC, code: "const n = container.querySelector(\".chip\")", errors: [{ messageId: "pinned" }] },
      { filename: LEAF_SPEC, code: "const n = container.querySelectorAll(\"div > .row\")", errors: [{ messageId: "pinned" }] },
    ],
  })
})

test("SPEC-2: a spec imports the unit beside it", () => {
  tester.run("spec-tests-its-neighbour", specTestsItsNeighbour, {
    valid: [
      { filename: LEAF_SPEC, code: "import { Chip } from \"./Chip\"" },
      { filename: LEAF_SPEC, code: "import { Chip } from \"./Chip.tsx\"" },
      { filename: BLOCK_SPEC, code: "import { Feed } from \"./index\"" },
      { filename: BLOCK_SPEC, code: "import { Feed } from \".\"" },
      { filename: "D:/repo/src/hooks/feed/useFeed.test.ts", code: "import { useFeed } from \"./useFeed\"" },
      { filename: LEAF_SPEC, code: "const mod = await import(\"./Chip\")" },
      { filename: COMPONENT, code: "export const x = 1" },
    ],
    invalid: [
      { filename: LEAF_SPEC, code: "import { Row } from \"../Row\"", errors: [{ messageId: "subject" }] },
      { filename: LEAF_SPEC, code: "import { render } from \"@testing-library/react\"", errors: [{ messageId: "subject" }] },
      { filename: BLOCK_SPEC, code: "import { Chip } from \"./Chip\"", errors: [{ messageId: "subject" }] },
    ],
  })
})

test("SPEC-3: no spec for a barrel", () => {
  tester.run("no-barrel-spec", noBarrelSpec, {
    valid: [
      { filename: BLOCK_SPEC, code: "import { Feed } from \"./index\"" },
      { filename: "D:/repo/src/hooks/feed/useFeed.test.ts", code: "export {}" },
    ],
    invalid: [
      { filename: "D:/repo/src/hooks/index.test.ts", code: "export {}", errors: [{ messageId: "barrel" }] },
      { filename: "D:/repo/src/modules/api/index.spec.ts", code: "export {}", errors: [{ messageId: "barrel" }] },
    ],
  })
})

test("SPEC-4: no double cast in a spec", () => {
  tester.run("no-double-cast-in-spec", noDoubleCastInSpec, {
    valid: [
      { filename: LEAF_SPEC, code: "const x = { id: 1 } as Course" },
      { filename: LEAF_SPEC, code: "const x = mock<Course>()" },
      { filename: COMPONENT, code: "const x = y as unknown as Course" },
    ],
    invalid: [
      { filename: LEAF_SPEC, code: "const x = { id: 1 } as unknown as Course", errors: [{ messageId: "double" }] },
      { filename: LEAF_SPEC, code: "const x = (fn as unknown) as jest.Mock", errors: [{ messageId: "double" }] },
    ],
  })
})

test("SPEC-5: a connected screen's spec runs an axe assertion", () => {
  tester.run("connected-spec-has-axe", connectedSpecHasAxe, {
    valid: [
      { filename: BLOCK_SPEC, code: "it(\"a11y\", async () => { expect(await axe(container)).toHaveNoViolations() })" },
      { filename: PAGE_SPEC, code: "it(\"a11y\", async () => { await expectNoAxeViolations(container) })" },
      // a leaf's or a pure twin's spec owes none: the connected screen's assertion covers what it draws
      { filename: LEAF_SPEC, code: "it(\"x\", () => {})" },
      { filename: "D:/repo/src/components/blocks/Feed/component.test.tsx", code: "it(\"x\", () => {})" },
    ],
    invalid: [
      { filename: BLOCK_SPEC, code: "it(\"renders\", () => {})", errors: [{ messageId: "axe" }] },
      { filename: PAGE_SPEC, code: "it(\"renders\", () => { expect(a).toBe(1) })", errors: [{ messageId: "axe" }] },
      { filename: "D:/repo/src/features/overlays/Compose/index.test.tsx", code: "it(\"renders\", () => {})", errors: [{ messageId: "axe" }] },
    ],
  })
})

test("SPEC-6: a spec never mocks next-intl", () => {
  tester.run("no-mocked-translations", noMockedTranslations, {
    valid: [
      { filename: LEAF_SPEC, code: "vi.mock(\"@/modules/api/client\", () => ({}))" },
      { filename: LEAF_SPEC, code: "render(<NextIntlClientProvider messages={messages} locale=\"vi\" />)" },
      { filename: COMPONENT, code: "vi.mock(\"next-intl\")" },
    ],
    invalid: [
      { filename: LEAF_SPEC, code: "vi.mock(\"next-intl\", () => ({ useTranslations: () => (k) => k }))", errors: [{ messageId: "mocked" }] },
      { filename: LEAF_SPEC, code: "jest.mock(\"next-intl/server\")", errors: [{ messageId: "mocked" }] },
      { filename: LEAF_SPEC, code: "vi.doMock(\"next-intl\", () => ({}))", errors: [{ messageId: "mocked" }] },
    ],
  })
})
