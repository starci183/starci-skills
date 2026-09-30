# Spec quality

Law module: `spec-quality.mjs`. Catalogue: R67 FE_SPEC_QUALITY, R60 (real catalogue in specs).

A spec is a claim about one unit's behaviour: no class-string pinning, it imports the unit beside it, no spec for a barrel, no `as unknown as`, an axe assertion for every connected screen, and a real `next-intl` catalogue instead of a mock.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/no-class-string-in-spec`

A component spec asserts behaviour, never a class string.

**Invalid** (`src/components/leaves/Chip/Chip.test.tsx`)

```ts
expect(el).toHaveClass("bg-primary")
```

**Valid** (`src/components/leaves/Chip/Chip.test.tsx`)

```ts
expect(screen.getByRole("button", { name: "Save" })).toBeEnabled()
```

**Finding code:** `FE_SPEC_QUALITY`

**Why:** The spec `<file>` pins class strings. A spec checks behaviour, not the stylesheet.

**Fix:** Assert by role, name, state or visible text.

## `starci-fe/spec-tests-its-neighbour`

A spec imports its sibling subject: `X.test.tsx` imports `./X`.

**Invalid** (`src/components/leaves/Chip/Chip.test.tsx`)

```ts
import { Row } from "../Row"
```

**Valid** (`src/components/leaves/Chip/Chip.test.tsx`)

```ts
import { Chip } from "./Chip"
```

**Finding code:** `FE_SPEC_QUALITY`

**Why:** The spec `<file>` does not import the subject next to it.

**Fix:** Move the spec next to its subject, or test the unit that sits next to it.

## `starci-fe/no-barrel-spec`

No `index.spec.ts(x)` beside an `index.ts(x)` that holds only imports and re-exports. The sibling is read and parsed: an `index.ts` that declares a function, class or value (implementation) may have its spec; a missing sibling is no finding.

**Invalid** (`src/hooks/index.spec.ts`, beside `src/hooks/index.ts` = `export * from "./useFeed"`)

```ts
// file: src/hooks/index.spec.ts
```

**Valid** (`src/modules/browser-storage/index.spec.ts`, beside an `index.ts` that declares `createStore` and exports two stores)

```ts
// file: src/modules/browser-storage/index.spec.ts
```

**Finding code:** `FE_SPEC_QUALITY`

**Why:** The spec `<file>` sits next to a barrel. A barrel has no behaviour to test.

**Fix:** Delete the spec; test each unit the barrel re-exports, next to that unit itself.

## `starci-fe/no-double-cast-in-spec`

A spec builds its values with the type's own shape, not `as unknown as`.

**Invalid** (`any spec`)

```ts
const x = { id: 1 } as unknown as Course
```

**Valid** (`any spec`)

```ts
const x = mock<Course>()
```

**Finding code:** `FE_SPEC_QUALITY`

**Why:** The spec `<file>` casts twice (`as unknown as`).

**Fix:** Build the value with a typed factory (`mock<T>()` or a fixture builder).

## `starci-fe/connected-spec-has-axe`

The spec of a connected block or feature runs an axe assertion.

**Invalid** (`src/components/blocks/Feed/index.test.tsx`)

```ts
it("renders", () => {})
```

**Valid** (`src/components/blocks/Feed/index.test.tsx`)

```ts
it("a11y", async () => { expect(await axe(container)).toHaveNoViolations() })
```

**Finding code:** `FE_SPEC_QUALITY`

**Why:** The spec `<file>` for a connected screen has no axe assertion.

**Fix:** Add `expect(await axe(container)).toHaveNoViolations()`.

## `starci-fe/no-mocked-translations`

A spec renders with the real catalogue; it never mocks `next-intl`. A `vi.mock("next-intl/server", factory)` in the spec of a server helper (no provider exists for it) is allowed when the factory - or a `vi.hoisted` block it reads - uses the app's real catalogue (an import that resolves into `modules/i18n/messages/`); a literal or key-echoing server mock, an automock, and any mock of the client `next-intl` stay findings.

**Invalid** (`any spec`)

```ts
vi.mock("next-intl", () => ({}))
```

**Valid** (`any spec`)

```ts
render(<NextIntlClientProvider messages={messages} locale="vi" />)
```

```ts
import messages from "@/modules/i18n/messages/vi.json"
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl")
  return { getTranslations: async () => createTranslator({ locale: "vi", messages }) }
})
```

**Finding code:** `FE_I18N_CATALOG`

**Why:** The spec `<file>` mocks `next-intl`, so it checks only keys and not the real catalog.

**Fix:** Client components: render inside `NextIntlClientProvider` with the real `messages/<locale>.json`. Server helpers (`next-intl/server`): the mock factory builds a translator from the real catalog (`createTranslator` with `modules/i18n/messages/<locale>.json`).
