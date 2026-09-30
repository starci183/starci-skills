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

**Vì sao (why):** Spec `<file>` ghim chuỗi class. Spec kiểm hành vi, không kiểm stylesheet.

**Cách sửa:** Assert theo role, tên, trạng thái hoặc chữ hiển thị.

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

**Vì sao (why):** Spec `<file>` không import chủ thể nằm cạnh nó.

**Cách sửa:** Đưa spec về cạnh chủ thể, hoặc test đúng đơn vị nằm cạnh.

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

**Vì sao (why):** Spec `<file>` đặt cạnh một barrel. Barrel không có hành vi để test.

**Cách sửa:** Xóa spec; test từng đơn vị mà barrel xuất lại, cạnh chính đơn vị đó.

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

**Vì sao (why):** Spec `<file>` ép kiểu hai lần (`as unknown as`).

**Cách sửa:** Dựng giá trị bằng factory có kiểu (`mock<T>()` hoặc fixture builder).

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

**Vì sao (why):** Spec `<file>` của màn hình kết nối không có assert axe.

**Cách sửa:** Thêm `expect(await axe(container)).toHaveNoViolations()`.

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

**Vì sao (why):** Spec `<file>` giả lập `next-intl`, nên chỉ kiểm khóa chứ không kiểm catalog thật.

**Cách sửa:** Component client: render trong `NextIntlClientProvider` với `messages/<locale>.json` thật. Helper server (`next-intl/server`): factory của mock dựng translator từ catalog thật (`createTranslator` với `modules/i18n/messages/<locale>.json`).
