/**
 * Twin tests for the spec quality rules (HFS R67, and the real-catalogue half of R60).
 *
 *   node --test spec-quality.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { at, slotTester } from "./fixtures/typed/tester.mjs"
import {
  connectedSpecHasAxe,
  noBarrelSpec,
  noClassStringInSpec,
  noDoubleCastInSpec,
  noMockedTranslations,
  rules,
  specTestsItsNeighbour,
} from "./spec-quality.mjs"

const tester = slotTester()

const BARRELS = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "spec-barrel")

const LEAF_SPEC = at("apps/web/src/components/leaves/Chip/Chip.test.tsx")
const BLOCK_SPEC = at("apps/web/src/components/blocks/Feed/index.test.tsx")
const PAGE_SPEC = at("apps/web/src/features/pages/Home/index.test.tsx")
const COMPONENT = at("apps/web/src/components/blocks/Feed/index.tsx")

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
      { filename: at("apps/web/src/hooks/feed/useFeed.test.ts"), code: "import { useFeed } from \"./useFeed\"" },
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

test("SPEC-3: no spec for a barrel, but a spec for an index that holds implementation is fine", () => {
  tester.run("no-barrel-spec", noBarrelSpec, {
    valid: [
      { filename: BLOCK_SPEC, code: "import { Feed } from \"./index\"" },
      { filename: at("apps/web/src/hooks/feed/useFeed.test.ts"), code: "export {}" },
      // live: starci-next-fe modules/browser-storage/index.ts declares createStore and two stores - it is not a barrel
      { filename: join(BARRELS, "implementation", "index.spec.ts"), code: "export {}" },
      // no sibling index: nothing to call a barrel
      { filename: join(BARRELS, "missing", "index.spec.ts"), code: "export {}" },
      { filename: at("apps/web/src/hooks/orders/index.test.ts"), code: "export {}" },
    ],
    invalid: [
      { filename: join(BARRELS, "barrel", "index.spec.ts"), code: "export {}", errors: [{ messageId: "barrel" }] },
      { filename: join(BARRELS, "barrel-tsx", "index.spec.tsx"), code: "export {}", errors: [{ messageId: "barrel" }] },
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
      { filename: at("apps/web/src/components/blocks/Feed/component.test.tsx"), code: "it(\"x\", () => {})" },
      // where the old folder regex misfired: a leaf named like a layer, a folder named components inside a module, a ui-package leaf
      { filename: at("apps/web/src/components/leaves/blocks/index.test.tsx"), code: "it(\"x\", () => {})" },
      { filename: at("apps/web/src/modules/components/index.test.tsx"), code: "it(\"x\", () => {})" },
      { filename: at("packages/nivo-ui/src/leaves/Chip/index.test.tsx"), code: "it(\"x\", () => {})" },
    ],
    invalid: [
      { filename: BLOCK_SPEC, code: "it(\"renders\", () => {})", errors: [{ messageId: "axe" }] },
      { filename: PAGE_SPEC, code: "it(\"renders\", () => { expect(a).toBe(1) })", errors: [{ messageId: "axe" }] },
      { filename: at("apps/web/src/features/overlays/Compose/index.test.tsx"), code: "it(\"renders\", () => {})", errors: [{ messageId: "axe" }] },
      { filename: at("apps/web/src/features/layouts/Shell/index.spec.tsx"), code: "it(\"renders\", () => {})", errors: [{ messageId: "axe" }] },
    ],
  })
})

test("SPEC-6: a spec never mocks next-intl; a next-intl/server mock must serve the real catalogue", () => {
  const SERVER_SPEC = at("apps/web/src/modules/i18n/server.spec.ts")
  const CLIENT_SPEC = at("apps/web/src/components/leaves/Chip/index.spec.tsx")
  const CATALOG = 'import vi_messages from "@/modules/i18n/messages/vi.json"\n'
  slotTester().run("no-mocked-translations", noMockedTranslations, {
    valid: [
      { filename: CLIENT_SPEC, code: "vi.mock(\"@/modules/api/client\", () => ({}))" },
      { filename: CLIENT_SPEC, code: "render(<NextIntlClientProvider messages={messages} locale=\"vi\" />)" },
      { filename: at("apps/web/src/components/blocks/Feed/index.tsx"), code: "vi.mock(\"next-intl\")" },
      // a server helper has no provider: the mock is legitimate when its factory serves the app's real catalogue
      {
        filename: SERVER_SPEC,
        code: CATALOG + "vi.mock(\"next-intl/server\", async () => { const { createTranslator } = await import(\"next-intl\"); return { getTranslations: async () => createTranslator({ locale: \"vi\", messages: vi_messages }) } })",
      },
      {
        filename: SERVER_SPEC,
        code: 'vi.mock("next-intl/server", async () => { const messages = (await import("../i18n/messages/vi.json")).default; return { getMessages: async () => messages } })',
      },
      {
        filename: SERVER_SPEC,
        code: CATALOG + 'const runtime = vi.hoisted(() => ({ messages: vi_messages }))\nvi.mock("next-intl/server", () => ({ getMessages: async () => runtime.messages }))',
      },
    ],
    invalid: [
      { filename: CLIENT_SPEC, code: "vi.mock(\"next-intl\", () => ({ useTranslations: () => (k) => k }))", errors: [{ messageId: "mocked" }] },
      { filename: CLIENT_SPEC, code: "vi.doMock(\"next-intl\", () => ({}))", errors: [{ messageId: "mocked" }] },
      // the client hooks stay a finding even when the spec imports the catalogue
      { filename: CLIENT_SPEC, code: CATALOG + "vi.mock(\"next-intl\", () => ({ useTranslations: () => () => vi_messages }))", errors: [{ messageId: "mocked" }] },
      // a server mock that answers with literals (live: starci-next-fe modules/i18n/server.spec.ts) does not serve the catalogue
      { filename: SERVER_SPEC, code: "vi.mock(\"next-intl/server\", () => ({ getTranslations: async () => (key) => `translated:${key}` }))", errors: [{ messageId: "mockedServer" }] },
      { filename: SERVER_SPEC, code: "jest.mock(\"next-intl/server\")", errors: [{ messageId: "mockedServer" }] },
      // importing the catalogue without using it in the factory is not serving it
      { filename: SERVER_SPEC, code: CATALOG + "vi.mock(\"next-intl/server\", () => ({ getMessages: async () => ({}) }))", errors: [{ messageId: "mockedServer" }] },
      // a JSON import from anywhere but the i18n module's messages is not the app's catalogue
      { filename: SERVER_SPEC, code: 'import other from "@/modules/config/other.json"\nvi.mock("next-intl/server", () => ({ getMessages: async () => other }))', errors: [{ messageId: "mockedServer" }] },
    ],
  })
})
