# @starci/eslint-canon-fe

The StarCi front-end lint canon for Next.js and TypeScript applications. It keeps
component ownership, accessibility, loading behavior, vendor boundaries, translations, naming,
and colocated class-name composition consistent without prescribing a custom rendering protocol.

```bash
npm i -D @starci/eslint-canon-fe eslint-plugin-react-hooks typescript
```

A repository's `eslint.config.mjs` is the managed one-liner `hfs sync` renders (and `hfs check` compares, R05/R17):

```js
import { loadHfs, starciFeConfig } from "@starci/eslint-canon-fe"
export default starciFeConfig({ hfs: loadHfs(import.meta.url) })
```

`loadHfs` reads the repository's `hfs.json` and the slot manifest shipped in `runtime/`. The factory returns two
flat-config blocks and owns everything about the law: which files are linted (from the HFS profile), which rules are on
(every one, at `error` - nothing is off and nothing is a warning), the React Hooks rules (`eslint-plugin-react-hooks` 7, its
recommended set lifted to `error`), typed linting, and the inline-directive fence (`noInlineConfig` plus
`reportUnusedDisableDirectives`). The repository states nothing.

- The **ignore** block: `node_modules`, `.next`, `dist`, `coverage`, `__generated__` and `.starci/`.
- The **source** block governs `apps/*/src/**` and `packages/*/src/**` with types (`parserOptions.projectService`) and
  `settings.starci.hfs`, the slot view path-scoped rules ask (`lib/hfs.mjs` `hfsOf`), never a path pattern.

`recommended`, `why`, `loadHfs`, `linterOptions` and the plugin itself are also
exported; `why[rule]` is `{ code, vi, fixVi }`, the finding code and the Vietnamese why the harness quotes.

## Rules

Each law has a page under [`docs/`](docs) with, for every rule, an invalid and a valid example and
its Vietnamese why. New in 5.0: [env-owner](docs/env-owner.md), [transport](docs/transport.md),
[client-boundary](docs/client-boundary.md), [hooks-folder](docs/hooks-folder.md),
[next-conventions](docs/next-conventions.md), [translation](docs/translation.md) (no literal copy at any
tier, no `vn-ok`), [brand-values](docs/brand-values.md), [native-controls](docs/native-controls.md),
[size-and-state-budget](docs/size-and-state-budget.md) and [lint-escape-hatch](docs/lint-escape-hatch.md). New in 5.1: [lists](docs/lists.md), [hygiene](docs/hygiene.md), [formatting](docs/formatting.md) and [type-safety](docs/type-safety.md), plus rules added to next-conventions, client-boundary, native-controls and transport. New in 6.1: `no-vietnamese-in-source` (English-only identifiers, strings, comments and test titles; the i18n fixtures slot `e2e/fixtures/i18n/` is the one exemption). New in 6.0: `effect-subscription-needs-cleanup` (timers, frames, listeners, observers, sockets and subscriptions are released against the same handle), `server-module-marks-server-only` ([client-boundary](docs/client-boundary.md)), `no-data-fetch-in-effect` sees indirect loads, `no-hardcoded-copy` reads templates and sentence values, `no-inline-lint-config` refuses `NOSONAR` and the coverage/formatter switches. Also new in 6.0: [grammar-boundary](docs/grammar-boundary.md) (`no-raw-structural-element`), `one-outcome-union` ([transport](docs/transport.md)), `i18n-stack-in-one-module` ([next-conventions](docs/next-conventions.md)), [size-growth](docs/size-growth.md) (`file-size-growth`: a file over the manifest's line budget is not born large and does not grow; the budget is `ruleParams.fe.fileLines`, read from the manifest copy in `runtime/`).

Older laws cover comments, file layout, icons and vendor ownership, landmarks, loading states,
naming, props, served locales, component splits, design tokens, type safety, typography, and
class-name ownership. Reusable class names belong in a colocated `classNames.ts` module and should
be composed with HeroUI `cn` using one utility token per argument.

The `drawing` law holds the split surfaces (blocks, pages, layouts, overlays under `components/`
or `features/`): the pure `XBase` takes `{ state, props, on }` of atoms (`base-props-atom`), only its
sibling `index.tsx` imports it and never re-exports it (`base-import-pair`), `XState` names drawn
shapes and never a data status (`no-data-status-shape`), and a block renders each slot's
loading/forbidden/error/empty through `SlotView` (`slot-status-through-slotview`). The law's name is
the `drawing` slot role of `component.tsx`; a split-surface reference tree lives under
`.claude/examples/`.

The one locale pattern everywhere is `next-intl`, a `[locale]` segment, default `vi`,
`localePrefix: "as-needed"`, and `proxy.ts` instead of `middleware.ts`.

Grammar is a business-neutral HeroUI-backed component package. Its components accept ordinary
typed React props and children.

## Requirements

ESLint 9+ (flat config), `eslint-plugin-react-hooks` 7+, and Node.js 20.9+.
