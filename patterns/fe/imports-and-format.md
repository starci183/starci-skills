# Imports and formatting — STRICT (lint-gated)

> How imports and formatting are written in the main FE app (branch `mtp`). Formatting is decided by
> **ESLint** — there is no Prettier and no `.editorconfig`. The pre-commit gate runs
> `eslint --max-warnings=0` on staged files, so a file you touch must be clean even of `warn`-level
> rules. Every example below is quoted from real code on `mtp`.

## 1. Formatting is ESLint, not Prettier — four hard rules

The ONLY authority is `eslint.config.mjs`. `.vscode/settings.json` sets
`defaultFormatter: "dbaeumer.vscode-eslint"` with `source.fixAll.eslint` on save. Do not add
Prettier and do not argue with the style — run `eslint --fix`.

| Rule (`eslint.config.mjs`) | Value |
|---|---|
| `indent` | **4 spaces**, never tabs |
| `quotes` | **double** `"…"` |
| `semi` | **never** — no semicolons |
| `linebreak-style` | off — CRLF and LF both fine; do not mass-convert |

```ts
const name = displayName ?? username

// Wrong: semicolon, single quotes, two-space indent
  const name = displayName ?? username;
```

Grounding: 5404 of 5404 import lines use double quotes, none single; zero import lines end in `;`.
That is the measured state of all of `src/`, not a suggestion.

## 2. `"use client"` — the FIRST line, and only when needed

The absolute first line, before any import: double-quoted, no semicolon, followed by one blank line.
728 client files open exactly this way.

It is needed for state or effect hooks, zustand, react-hook-form, event handlers, and browser APIs.
It is not needed for a pure render-props block, or for an SWR or util file with no browser hook.

```tsx
// src/components/blocks/cards/CourseCard/index.tsx
"use client"

import React, { useCallback, useMemo, useState } from "react"
```

```tsx
// Wrong: single quotes and a semicolon
'use client';
```

## 3. Import order: external → `@/` → relative

This is a convention, not a machine-enforced rule — there is no `import/order` plugin, so you hold
the order yourself, and a review sends back a file that breaks it:

1. `"use client"` if present, then a blank line
2. `react` first — `import React, { useMemo } from "react"`
3. `next/*` — `next/dynamic`, `next/link`, …
4. the vendor UI package, then the remaining external packages (`next-intl`, `framer-motion`, `swr`,
   `zustand`, `zod`, `@phosphor-icons/react`, …)
5. absolute `@/…` — `@/components/…`, `@/modules/…`
6. relative `../` and `./`

```tsx
// src/components/features/architecture/ArchitectureMap/index.tsx
import React, { useMemo } from "react"
import dynamic from "next/dynamic"
import { Chip, Skeleton, cn } from "@heroui/react"
import { useTranslations } from "next-intl"
import { TabsCard } from "@/components/blocks/navigation/TabsCard"   // @/ first
import type { HealthByName } from "../hooks/useSystemHealthPoll"     // then relative
import { ARCHITECTURE_MODULE_MAP } from "../modules"
import { buildLiveScene } from "./scene"
```

A blank line between groups is OPTIONAL — most files run the block together, a few separate external
from relative with one blank line. If you use one, put it BETWEEN groups rather than scattering it.

## 4. `import type { WithClassNames }` usually DRIFTS to the bottom

The real idiom (669 files, re-measured 2026-07-31): the type import of `WithClassNames` from
`@/modules/types/base/class-name` sits at the END of the import block, after the relative imports —
deliberately breaking the order in §3. Accept the existing idiom; do not "fix the order" and
generate a diff nobody asked for.

```tsx
// src/components/features/architecture/ArchitectureMap/index.tsx — last line of the import block
import { buildFutureScene } from "./future-scene"
import type { WithClassNames } from "@/modules/types/base/class-name"
```

## 5. `import type` for type-only imports — always split out

An import used ONLY as a type becomes `import type { X }` — 982 statements. `isolatedModules: true`
in `tsconfig` makes this load-bearing for correct emit and tree-shaking. When a module supplies both
a value and a type, split them across two lines.

```tsx
// src/components/blocks/async/AsyncContent/index.tsx
import React from "react"
import type { ReactNode } from "react"

import { EmptyContent } from "../EmptyContent"
import type { EmptyContentProps } from "../EmptyContent"
```

```tsx
// Wrong: dragging a type into a value import — against the repo idiom
import React, { ReactNode } from "react"
```

## 6. `@/` alias across areas, relative for siblings — no deep `../../../`

- `@/*` maps to `./src/*` (`tsconfig.json` `paths`). Use `@/…` when crossing into another area
  (3260 occurrences). Use relative `./` and `../` for a file in the SAME feature folder (940).
- Deep relative — climbing three or more levels — occurs 15 times in the whole repo. Treat it as
  banned and switch to `@/`.
- Never write the `.ts` or `.tsx` extension in an import; zero files do. `from "./scene"`, not
  `"./scene.ts"`.

```tsx
// src/components/features/architecture/ArchitectureRail/index.tsx
import { MetricsInline } from "../MetricsInline"                        // sibling → relative
import type { WithClassNames } from "@/modules/types/base/class-name"   // cross-area → @/
```

```tsx
// Wrong: climbing instead of aliasing
import { WithClassNames } from "../../../../modules/types/base/class-name"
```

## 7. A long named import goes multiline, 4-space, with a trailing comma

Keep a short named list INLINE. A long one — roughly four names or more — puts each name on its own
line, indented four spaces, WITH a trailing comma. By idiom, `cn` (the class merger) sits LAST in
the vendor package's named list.

```tsx
// src/components/blocks/cards/CourseCard/index.tsx — long, so multiline with a trailing comma
import {
    Button,
    Card,
    Chip,
    Typography,
    cn,
} from "@heroui/react"

// same file — short, so inline
import { Skeleton } from "@/components/blocks/skeleton/Skeleton"
```

## 8. Banned imports (the linter catches these)

- `@gravity-ui/icons` and any `@gravity-ui/*` — `no-restricted-imports` at **error**. Use
  `@phosphor-icons/react`; the migration is finished and zero files still reference `@gravity-ui`.
- `clsx` and `tailwind-merge` directly — **`cn` from the vendor package** is the ONLY class merger.
  Zero files use clsx or tailwind-merge; 294 use `cn`.
- The house plugin at **error**: `no-fractional-spacing`, `no-adjacent-chip`,
  `no-modal-title-classname`. At **warn** — which still blocks the gate for a staged file:
  `no-hero-heading-class`, `no-arbitrary-token` (no arbitrary spacing or hex such as `[13px]` or
  `[#abc]`; use a token). Do not introduce new warnings.
- The jsx-a11y `warn` set (`alt-text`, `anchor-is-valid`, `click-events-have-key-events`,
  `label-has-associated-control`, …): an interactive div needs a role and a key handler, and an
  icon-only button needs an accessible name.

## 9. TypeScript strict

- `strict: true`, target ES2017, `jsx: react-jsx` — so **you do not need `import React` merely to
  write JSX** (`react/react-in-jsx-scope` is off). Still import React when using `React.ReactNode`
  or hooks, following the repo's own pattern.
- Verify after editing: `npx tsc --noEmit` and `npx eslint <files>`. Both must be clean.

Related: [[structure-and-naming]] · [[props-and-types]] (`WithClassNames`) · [[type-safety]].
