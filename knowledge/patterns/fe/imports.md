# Imports

This file answers one question: given a frontend file, what may it import, through which path,
and in which order?

Sources: `tsconfig.json` (`paths`), `eslint.config.mjs`, `src/hooks/index.ts`,
`src/components/**`, `src/hooks/swr/**`.

## FE-IMPORTS-1 — Paths

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Anything under `src/` from another folder | `@/…` — the only alias (`"@/*": ["./src/*"]`); 459 files use it |
| Case 2 | A Grammar object | `import { SurfaceCard, Text, Heading, Badge, Button } from "@starci/grammar/common"` (553 imports, all through `/common`) |
| Case 3 | HeroUI | `import { cn } from "@heroui/react"` in `classNames.ts` (136 of 151); vendor components in leaves (48) and blocks (74); page `component.tsx` never (0/49) |
| Case 4 | Files inside the same unit | `./component`, `./classNames`, `./index` |
| Case 5 | Type only | `import type { AuthMode } from "@/hooks/auth/useAuthPanel"`, `import { type CourseDetail } from "…"` (274 files) |

## FE-IMPORTS-2 — Order

Not lint-enforced (no `import/order` rule is configured). The dominant order, read from the first
import of 417 component files, is framework, then Grammar, then own tiers, then own unit.

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Framework first | `react` (108 files), `next-intl` (45), `next` / `next/navigation` (16), `swr` |
| Case 2 | Then Grammar | `@starci/grammar/common` (95 files start here when no framework import exists) |
| Case 3 | Then own tiers | `@/components/branches/…`, `@/components/leaves/…`, `@/hooks`, `@/modules/…` (88 files start with `@/components`) |
| Case 4 | Own unit last | `import { aiChatClassNames, getAiChatBubbleClassName } from "./classNames"`, `import { AuthenticationPageBase } from "./component"` |

`blocks/ai/StarCiAiChat/component.tsx` interleaves `@starci/grammar/common` and `@/components/…`
imports alphabetically by binding instead; the order above is dominant, not universal.

## FE-IMPORTS-3 — Data enters a block through the hooks barrel

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A block reads or writes | `import { useQueryCourseSwr } from "@/hooks"` (82 block files import `@/hooks`); the barrel docblock: "A block imports `@/hooks`, never `@/hooks/swr/useQuerySomethingSwr`" |
| Case 2 | A hook reaches the transport | `import { queryCourse } from "../../modules/api/graphql/queries/query-course"` (57 hook files) or `from "@/modules/api/…"` (56 hook files) — evenly split, see open question |
| Case 3 | A type from the data layer | `import type { CourseAdvisorRecommendation } from "@/modules/ai/course-advisor-response"` — types are not re-exported by the barrel |
| Case 4 | Auth identity | `import { useViewerKey } from "@/hooks/auth/useViewerKey"` inside hooks; components mock `@/hooks/auth/useSessionToken` in specs |

## FE-IMPORTS-4 — Tier direction

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Page → block | `import { AuthenticationPanel } from "@/components/blocks/auth/AuthenticationPanel"` (48 of 50 pages import blocks; 11 import leaves; 8 import hooks; 1 imports modules) |
| Case 2 | Block → leaf, branch, Grammar, hooks, modules | `import { CodeBlock } from "@/components/leaves/CodeBlock"`, `import { Article } from "@/components/branches/Article"` (82 blocks import hooks, 67 import modules) |
| Case 3 | Leaf → Grammar and vendor only | `import type { ButtonVariant } from "@starci/grammar/common"`, `import { buttonVariants } from "@heroui/styles"` (1 leaf imports hooks, 1 imports a block: outliers) |
| Case 4 | Upward import | block → page observed once; leaf → block observed once; neither is a pattern |
| Case 5 | Pure half → data layer | never at runtime; 18 `component.tsx` files use `import type` from `@/modules/api/graphql/queries/…` only |

## FE-IMPORTS-5 — Vendor boundaries

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Glyphs | only the Icon leaf imports `@heroicons/react` (1 component file); everything else takes the Grammar `Icon` with a source prop (lint `no-vendor-icon-outside-icon-leaf`, `heroicons-is-the-glyph-vendor`) |
| Case 2 | Headings | `Heading` from Grammar, never a raw `<h2>` (lint `no-heading-tag-outside-heading-component`) |
| Case 3 | Grammar package dependencies | `peerDependencies` are exactly `@heroui/react` and `react`; `dependencies` is empty (`package-boundary.test.mjs`) |

## FE-IMPORTS-6 — Re-exports

| Case | When | Write |
| --- | --- | --- |
| Case 1 | The hooks barrel | `export { useMutateAddToCartSwr } from "./swr/useMutateAddToCartSwr"` — one line per hook, no `export *` |
| Case 2 | Grammar family entry | `export { COMMON_SPACING_SCALE, COMMON_SPACING_TOKENS, type CommonSpacingStep, … } from "./spacing.js"` — named, with `.js` suffix |
| Case 3 | Block index re-exporting its twin | `export * from "./component"` at the end of `index.tsx` — 19 of 95 block indexes and 19 of 49 page indexes do this; the majority do not |

## FE-IMPORTS-7 — Forbidden

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Deep hook path from a component | `@/hooks/swr/useQueryCourseSwr` — escapes `vi.mock("@/hooks")` |
| Case 2 | Default export from `src/components` | 0 exist |
| Case 3 | Inline lint config | `eslint-disable` appears in 0 files; `src/components/blocks/**/{index,component}.tsx` run with `noInlineConfig: true` |
| Case 4 | `namespace` | only `src/modules/api/graphql/clients/options.ts`, by config exception |

## Open questions

- Hooks reach `modules/api` through `../../modules/api/…` in 57 files and `@/modules/api/…` in 56.
  No variant dominates; this file does not choose.
- `export * from "./component"` at the end of a connected `index.tsx` is present in 19/95 blocks
  and absent in the rest. Not legislated.
