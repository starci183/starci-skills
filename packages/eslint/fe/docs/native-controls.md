# No native form controls

Law module: `native-controls.mjs`. Catalogue: R62 FE_NATIVE_FORM_CONTROL.

`<select>`, `<input>`, `<textarea>` and `<button>` are rendered by the grammar in product source, at every tier. If the grammar lacks the control, add it to the grammar.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/no-native-form-control`

Use the grammar's renderers; never a bare select, input, textarea or button.

**Invalid** (`src/components/blocks/Feed/index.tsx`)

```ts
<button onClick={go} />
```

**Valid** (`src/components/blocks/Feed/index.tsx`)

```ts
<Button onPress={go}>{t("go")}</Button>
```

**Finding code:** `FE_NATIVE_FORM_CONTROL`

**Why:** Raw `<tag>` in `<file>`. Use the grammar renderer.

**Fix:** Replace it with a grammar component; if none exists, add it to the grammar instead of drawing it in place.

## `starci-fe/no-native-img`

Use `next/image`, never a bare `<img>` (catalogue R62, sub-check `FE_NATIVE_IMAGE`).

**Invalid** (`src/components/blocks/Feed/component.tsx`)

```tsx
<img src={src} alt={t("cover")} />
```

**Valid** (`src/components/blocks/Feed/component.tsx`)

```tsx
<Image src={src} alt={t("cover")} width={40} height={40} />
```

**Finding code:** `FE_NATIVE_IMAGE`

**Why:** Raw `<img>` in `<file>`: it loads the original image and reserves no space, so the page jumps when the image loads.

**Fix:** Use `Image` from `next/image` with `width` and `height` (or `fill` and `sizes`) and `alt` from the catalog.

## `starci-fe/image-has-size`

`next/image` carries `width` and `height`, or `fill` with `sizes` (sub-check `FE_NATIVE_IMAGE`).

**Invalid** (`src/components/blocks/Feed/component.tsx`)

```tsx
<Image src={src} alt={t("cover")} />
```

**Valid** (`src/components/blocks/Feed/component.tsx`)

```tsx
<Image src={src} alt={t("cover")} width={40} height={40} />
```

**Finding code:** `FE_NATIVE_IMAGE`

**Why:** `Image` in `<file>` lacks `width` and `height` (or has `fill` without `sizes`): the browser cannot reserve space.

**Fix:** Provide both `width` and `height`, or `fill` inside a sized frame together with `sizes`.
