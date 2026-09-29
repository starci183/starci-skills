# No inline suppression of any spelling

Law module: `lint-escape-hatch.mjs`. Catalogue: R18 HFS_INLINE_SUPPRESSION.

No `eslint-disable` (line, next-line, block), `eslint-enable`, `eslint-env`, inline `eslint rule: ...` config, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, and no retired `vn-ok:` pragma. `noInlineConfig` makes a directive ineffective, this rule makes it a finding, and `reportUnusedDisableDirectives` reports a leftover that suppresses nothing. The rule covers `src/**`, specs and the e2e tree.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/no-inline-lint-config`

Source cannot change its own lint or type-check policy, and the vn-ok pragma is retired.

**Invalid** (`src/components/blocks/Feed/index.tsx`)

```ts
// eslint-disable-next-line no-console
// @ts-ignore
const s = "x" // vn-ok: reason
```

**Valid** (`src/components/blocks/Feed/index.tsx`)

```ts
// the rule is fixed centrally; fix the code instead
const s = 1
```

**Finding code:** `HFS_INLINE_SUPPRESSION`

**Vì sao (why):** Có chú thích tắt luật ở `<file>:<line>`. HFS không cho tắt tại chỗ — sửa code, hoặc đề xuất đổi luật.

**Cách sửa:** Xóa `eslint-disable`, `@ts-ignore`, `@ts-expect-error` hoặc `vn-ok` và sửa nguyên nhân.
