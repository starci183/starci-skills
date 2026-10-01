# Translation: no literal copy, no pragma

Law module: `translation.mjs`. Catalogue: R58 FE_I18N_LITERAL.

No text a reader can see or hear is written in source, at any tier and in any language: it is read from a `next-intl` catalogue through `t()`. There is no `vn-ok` pragma, no endonym exemption and no `resources/` copy folder; the catalogues (`messages/<locale>.json`), fixtures and specs are the only content paths. The notion of a literal is the same as the repository's i18n catalog check: a word is two or more letters, and the copy attributes are `label`, `title`, `alt`, `placeholder` and the `aria-*` set.

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
const status = { ready: "Your course is ready" }
<p>{`${count} installed`}</p>
```

**Valid** (`src/components/blocks/Feed/index.tsx`)

```ts
<button>{t("save")}</button>
<input placeholder={t("search")} />
const o = { title: t("courses.title") }
```

A template literal with substitutions is copy when its static parts contain a word (`${count} installed`, `You have ${c} unread messages`) in a JSX child, a copy attribute or a copy-key value; class names, URLs, keys, ids, units and format tokens (`btn-${tone}`, `/courses/${id}`, `${n}px`, `YYYY-MM-DD HH:mm`) are not copy. An object property under any key is copy when its value is a whole sentence (two or more words, starting like a sentence, ending like one, or in a non-ASCII script): a hook returning `{ ready: "Your course is ready" }` is a finding.

**Finding code:** `FE_I18N_LITERAL`

**Why:** The text `"<text>"` at `<file>:<line>` does not go through `t()`.

**Fix:** Move the sentence into `modules/i18n/messages/<locale>.json` and read it with `t("key")`; there is no exception and no `vn-ok`.
