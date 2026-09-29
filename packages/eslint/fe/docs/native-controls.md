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

**Vì sao (why):** `<tag>` thô ở `<file>`. Dùng renderer của grammar.

**Cách sửa:** Thay bằng thành phần của grammar; nếu chưa có, thêm vào grammar thay vì vẽ tại chỗ.

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

**Vì sao (why):** `<img>` thô ở `<file>`: tải ảnh gốc, không giữ chỗ nên trang nhảy khi ảnh tải xong.

**Cách sửa:** Dùng `Image` của `next/image` với `width` và `height` (hoặc `fill` và `sizes`) và `alt` từ catalog.

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

**Vì sao (why):** `Image` ở `<file>` thiếu `width` và `height` (hoặc `fill` mà thiếu `sizes`): trình duyệt không giữ chỗ được.

**Cách sửa:** Cho đủ `width` và `height`, hoặc `fill` trong khung có kích thước kèm `sizes`.
