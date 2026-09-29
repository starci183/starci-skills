# Translation: no literal copy, no pragma

Law module: `translation.mjs`. Catalogue: R58 FE_I18N_LITERAL.

No text a reader can see or hear is written in source, at any tier and in any language: it is read from a `next-intl` catalogue through `t()`. There is no `vn-ok` pragma, no endonym exemption and no `resources/` copy folder; the catalogues (`messages/<locale>.json`), fixtures and specs are the only content paths. The notion of a literal is the same as nivo-fe's `scripts/check-i18n-catalog.mjs`: a word is two or more letters, and the copy attributes are `label`, `title`, `alt`, `placeholder` and the `aria-*` set.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/no-copy-resolution-below-block`

The vocabulary tiers receive resolved strings; they never resolve one.

**Invalid** (`src/components/leaves/Input/index.tsx`)

```ts
const t = useTranslations("input")
```

**Valid** (`src/components/leaves/Input/index.tsx`)

```ts
const E = ({ props }) => props.label
```


## `starci-fe/no-hardcoded-copy`

User-facing text comes from a `next-intl` catalogue through `t()`, at every tier.

**Invalid** (`src/components/blocks/Feed/index.tsx`)

```ts
<button>Save</button>
<input placeholder="Search courses" />
const o = { title: "Your courses" }
```

**Valid** (`src/components/blocks/Feed/index.tsx`)

```ts
<button>{t("save")}</button>
<input placeholder={t("search")} />
const o = { title: t("courses.title") }
```

**Finding code:** `FE_I18N_LITERAL`

**Vì sao (why):** Chữ `"<text>"` ở `<file>:<line>` không đi qua `t()`.

**Cách sửa:** Chuyển câu vào `modules/i18n/messages/<locale>.json` và đọc bằng `t("khóa")`; không có ngoại lệ và không có `vn-ok`.
