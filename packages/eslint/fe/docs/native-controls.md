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
