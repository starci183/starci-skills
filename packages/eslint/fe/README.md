# @starci/eslint-canon-fe

The StarCi front-end lint canon for Next.js and TypeScript applications. It keeps
component ownership, accessibility, loading behavior, vendor boundaries, translations, naming,
and colocated class-name composition consistent without prescribing a custom rendering protocol.

```bash
npm i -D @starci/eslint-canon-fe eslint-plugin-react-hooks
```

```js
import { starciFeConfig } from "@starci/eslint-canon-fe"

export default [...starciFeConfig({ layout: "single-app" })]
```

The factory returns two flat-config blocks and owns everything about the law: which rules are on
(every one, at `error` - nothing is off and nothing is a warning), the React Hooks rules
(`eslint-plugin-react-hooks` 7, its recommended set lifted to `error`, including
`set-state-in-effect` and `refs`), and the inline-directive fence (`noInlineConfig` plus
`reportUnusedDisableDirectives`). A repository names its layout and nothing else.

- The **source** block governs `src/**` (`single-app`) or `packages/*/src/**` (every workspace package, not one named `ui`) and `apps/*/src/**`
  (`monorepo`). A package keeps its grammar tiers at `src/{composites,branches,leaves}`; the client-boundary rule reads that layout as well as an app's `src/components/`.
- The **e2e** block governs `e2e/**` and `playwright.config.*` with the e2e rules and the
  escape-hatch fence.

`recommended`, `sourceRecommended`, `e2eRecommended`, `why`, `audits` and the plugin itself are also
exported. `sourceRecommended` is the map to compare against a production probe file with
`audits["effective-config"]`; `why[rule]` is `{ code, vi, fixVi }`, the finding code and the
Vietnamese why the harness quotes.

## Rules

Each law has a page under [`docs/`](docs) with, for every rule, an invalid and a valid example and
its Vietnamese why. New in 5.0: [env-owner](docs/env-owner.md), [transport](docs/transport.md),
[client-boundary](docs/client-boundary.md), [hooks-folder](docs/hooks-folder.md),
[next-conventions](docs/next-conventions.md), [translation](docs/translation.md) (no literal copy at any
tier, no `vn-ok`), [brand-values](docs/brand-values.md), [native-controls](docs/native-controls.md),
[size-and-state-budget](docs/size-and-state-budget.md), [e2e-shape](docs/e2e-shape.md),
[spec-quality](docs/spec-quality.md) and [lint-escape-hatch](docs/lint-escape-hatch.md). `timer-needs-effect-cleanup` also accepts a timer whose enclosing function returns a cleanup clearing the same handle (5.1.2). New in 5.1: [lists](docs/lists.md), [hygiene](docs/hygiene.md), [formatting](docs/formatting.md) and [type-safety](docs/type-safety.md), plus rules added to next-conventions, client-boundary, native-controls and transport.

Older laws cover comments, file layout, icons and vendor ownership, landmarks, loading states,
naming, props, served locales, component splits, design tokens, type safety, typography, and
class-name ownership. Reusable class names belong in a colocated `classNames.ts` module and should
be composed with HeroUI `cn` using one utility token per argument.

The `shape-slot` law holds the split surfaces (blocks, pages, layouts, overlays under `components/`
or `features/`): the pure `XBase` takes `{ state, props, on }` of atoms (`base-props-atom`), only its
sibling `index.tsx` imports it and never re-exports it (`base-import-pair`), `XState` names drawn
shapes and never a data status (`no-data-status-shape`), and a block renders each slot's
loading/forbidden/error/empty through `SlotView` (`slot-status-through-slotview`). Reference tree:
`.claude/examples/shape-slot`.

The one locale pattern everywhere is `next-intl`, a `[locale]` segment, default `vi`,
`localePrefix: "as-needed"`, and `proxy.ts` instead of `middleware.ts`.

Grammar is a business-neutral HeroUI-backed component package. Its components accept ordinary
typed React props and children.

## Requirements

ESLint 9+ (flat config), `eslint-plugin-react-hooks` 7+, and Node.js 20.9+.
