# lint escape hatch

## Definition

A lint escape hatch is source text that changes which laws apply to the file containing it:
`eslint-disable`, its line variants, or `eslint-enable`. It turns a repository law into a local
choice, so the author of the violation also becomes the author of whether it is a violation.

What holds this law is
[`sources/fe/lint-escape-hatch.mjs`](../../../sources/fe/lint-escape-hatch.mjs). The consuming flat
config also applies the exported `linterOptions.noInlineConfig`, because a rule that could be
disabled by the comment it reports would not be a fence.

Implementation anchors in `starci-academy-fe`: `eslint.config.mjs` and
`plugins/eslint/index.mjs`.

## Rules

**LINT-ESCAPE-1 · Product source cannot contain an inline ESLint directive.**

Every rule is repository policy at `error`. A file cannot lower, suspend or restore that policy for
itself; if a rule is wrong, its matcher or the architecture is corrected for everyone.

**LINT-ESCAPE-2 · The flat config disables inline configuration.**

The rule reports the attempted bypass, while `noInlineConfig` makes the attempt ineffective. Both
are required: one explains the failure and the other guarantees the directive cannot silence its
own guard.

**LINT-ESCAPE-3 · There is no allowlist.**

Thin components, vendor boundaries, declarations, generated-looking files and temporary migration
work do not earn local exemptions. A legitimate syntax is represented in shared configuration or a
closed type; debt is fixed before merge rather than hidden beside it.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| `eslint-disable` in product source | The violating file decides whether repository law applies | Fix the code or the shared rule |
| `eslint-disable-next-line` with a reason | A reason documents the bypass; it does not stop the bypass | Encode the legitimate case in the rule or type |
| A path allowlist for one component | The exception becomes permanent and invisible at the call site | State the semantic case in the shared matcher |
| A warning-level architectural rule | New violations merge while appearing governed | Error, with a twin test |

## Examples

### The local bypass

```ts
declare module "vendor" {
    namespace VendorTypes {}
}
```

```ts
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace VendorTypes {}
```

They differ in one thing: whether the repository configuration owns the legitimate declaration
syntax or one file suspends the law for itself.

### The architectural finding

```tsx
return <_CreditStatRow state="pending" props={{ label }} />
```

```tsx
/* eslint-disable starci-fe/connected-block-has-presentational-twin */
return <StatRow props={{ label }} isLoading />
```

They differ in one thing: whether the connected/presentational boundary still exists.
