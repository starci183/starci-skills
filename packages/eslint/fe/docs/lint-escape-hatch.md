# No inline suppression of any spelling

Law module: `lint-escape-hatch.mjs`. Catalogue: R18 HFS_INLINE_SUPPRESSION.

No `eslint-disable` (line, next-line, block), `eslint-enable`, `eslint-env`, inline `eslint rule: ...` config, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, no retired `vn-ok:` pragma, and no `NOSONAR`, `@sonar-ignore`, `istanbul ignore`, `c8 ignore`, `v8 ignore`, `prettier-ignore` or `stylelint-disable` comment. `noInlineConfig` makes a directive ineffective, this rule makes it a finding, and `reportUnusedDisableDirectives` reports a leftover that suppresses nothing. The rule covers `src/**`, specs and the e2e tree.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/no-inline-lint-config`

Source cannot change its own lint or type-check policy, and the vn-ok pragma is retired.

**Invalid** (`src/components/blocks/Feed/index.tsx`)

```ts
// eslint-disable-next-line no-console
// @ts-ignore
// NOSONAR
/* istanbul ignore next */
const s = "x" // vn-ok: reason
```

**Valid** (`src/components/blocks/Feed/index.tsx`)

```ts
// the rule is fixed centrally; fix the code instead
const s = 1
```

**Finding code:** `HFS_INLINE_SUPPRESSION`

**Why:** There is a rule-disabling comment at `<file>:<line>`. HFS does not allow disabling in place - fix the code, or propose changing the rule.

**Fix:** Remove `eslint-disable`, `@ts-ignore`, `@ts-expect-error` or `vn-ok` and fix the cause.
