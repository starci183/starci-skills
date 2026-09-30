# No raw brand values in TypeScript

Law module: `brand-values.mjs`. Catalogue: R61 FE_STYLE_TOKEN_ONLY (TypeScript half; CSS belongs to @starci/stylelint-canon).

Colour values exist only in `modules/brand/brand.css`, on the tokens the grammar declares, with a light and a dark value. A hex, a colour function, a named paint colour or a pixel length in TypeScript skips the token scale.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/no-raw-brand-value`

No hex, colour function, named paint colour or px length in TypeScript; tokens only.

**Invalid** (`src/components/blocks/Feed/index.tsx`)

```ts
const c = "#ff0000"
<div style={{ width: 12 }} />
```

**Valid** (`src/components/blocks/Feed/index.tsx`)

```ts
<div className="bg-surface p-4" />
```

**Finding code:** `FE_STYLE_TOKEN_ONLY`

**Why:** `<file>` uses a raw colour/length value (`<what>`). Colours and spacing come only from grammar tokens; brand colours live only in `brand.css`.

**Fix:** Use a grammar token class or variable; colour values are declared only in `modules/brand/brand.css`.
