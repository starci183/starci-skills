# Folder

This file answers one question: given a piece of frontend code, which directory and which file
name does it get?

Sources: the reference application's `src/components/**`, `src/hooks/**`, `src/modules/api/**`, `src/app/**`,
`packages/grammar/src/**`. Counts are file counts at the time of reading.

## FE-FOLDER-1 — Tier directories

`src/components/` holds eight tier folders. Blocks are grouped by product domain; pages and leaves
are flat.

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A reusable fixed visual unit | `src/components/leaves/<Name>/` (40 units, flat) |
| Case 2 | A feature unit with a connected half | `src/components/blocks/<domain>/<Name>/` (109 units under 11 domains: `ai auth coding commerce community courses dashboard learn locale profile search`) |
| Case 3 | A routed screen | `src/components/pages/<Name>Page/` (50 units, flat) |
| Case 4 | Other tiers present | `branches/`, `composites/`, `layouts/`, `overlays/`, `product-shells/` |

## FE-FOLDER-2 — The file set of one unit

One unit is one PascalCase folder. Its files carry fixed names; the unit name is the folder, never
the file.

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Page unit (`pages/AuthenticationPage/`) | `classNames.ts` · `component.tsx` · `index.tsx` |
| Case 2 | Page unit with specs (`pages/CartPage/`) | `component.tsx` · `index.spec.tsx` · `index.tsx` |
| Case 3 | Block unit (`blocks/ai/StarCiAiChat/`) | `classNames.ts` · `component.spec.tsx` · `component.tsx` · `index.spec.tsx` · `index.tsx` |
| Case 4 | Leaf unit (`leaves/ButtonStateSample/`) | `classNames.ts` · `index.tsx` — a leaf has no `component.tsx`, because it has no connected half |

Counts across pages (50): `index.tsx` 49, `component.tsx` 49, `component.spec.tsx` 42,
`index.spec.tsx` 24, `audit.md` 22, `classNames.ts` 9. Across blocks (109): `component.tsx` 101,
`index.tsx` 95, `classNames.ts` 76, `index.spec.tsx` 61, `component.spec.tsx` 55. Across leaves
(40): `index.tsx` 40, `classNames.ts` 33, `index.spec.tsx` 19.

`classNames.ts` is present only when the unit owns class strings. A page that composes a block
into a Grammar frame usually has none; the 9 pages that have one alias a Grammar page frame:

```ts
// pages/AuthenticationPage/classNames.ts
import { cn } from "@heroui/react"
import { formPageClassName } from "@grammar/common"

/** Grammar-owned page frame; this app alias adds no visual override. */
export const authenticationPageClassName = cn(formPageClassName)
```

## FE-FOLDER-3 — Route files mount one page

`src/app/[lang]/**/page.tsx` is the only place a default export exists (67 in `src/app`, 0 in
`src/components`).

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A route | `app/[lang]/authentication/page.tsx`: `import { AuthenticationPage } from "@/components/pages/AuthenticationPage"` … `const AuthenticationRoute = () => <AuthenticationPage {...{}} />` … `export default AuthenticationRoute` |
| Case 2 | Global app files | `app/globals.css`, `app/providers.tsx`, `app/global-error.tsx`, `app/sitemap.ts`, `app/robots.ts`, each with a sibling `.spec` |

## FE-FOLDER-4 — Data layer placement

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A read hook | `src/hooks/swr/useQuery<Thing>Swr.ts` (80) with sibling `.spec.ts` |
| Case 2 | A write hook | `src/hooks/swr/useMutate<Thing>Swr.ts` (32) with sibling `.spec.ts` |
| Case 3 | Auth / socket hooks | `src/hooks/auth/useSessionToken.ts`, `src/hooks/socketio/**` |
| Case 4 | The one door for components | `src/hooks/index.ts` re-exports hooks only ("Hooks ONLY. Types, cache keys and query modules stay behind their own paths") |
| Case 5 | A GraphQL document | `src/modules/api/graphql/queries/query-<thing>.ts`, `src/modules/api/graphql/mutations/mutation-<thing>.ts` |
| Case 6 | Response/request types | `src/modules/api/graphql/queries/types/<thing>.ts` |
| Case 7 | Non-API modules | `src/modules/{ai,code,learn,routing,search,theme,toast,types,utils}/` |

## FE-FOLDER-5 — Grammar package unit

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A Grammar component | `packages/grammar/src/core/<primitive|composite|branch|composition>/<Name>/index.tsx` (39 `index.tsx`) |
| Case 2 | Its class strings | sibling `classNames.ts` (13), e.g. `core/branch/Rail/classNames.ts` |
| Case 3 | Its spec | sibling `index.spec.tsx` (24); CSS proof in `styles.spec.ts` (6) |
| Case 4 | Family entry | `core/index.ts`, `core/styles.css`, `core/dna.ts`; `common/index.ts` re-exports `state.js`, `spacing.js`, `conformance.js`, `renderers.js`, `registry.js` |
| Case 5 | Built-output proof | `common/index.test.mjs`, `core/index.test.mjs`, `package-boundary.test.mjs` (node:test against `dist/`) |

## FE-FOLDER-6 — What a unit folder does not hold

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A second component in the same folder | Not observed in 87 of 109 block folders; the unit is one export per `index.tsx`/`component.tsx` |
| Case 2 | Class strings in `component.tsx` | Never; they go to `classNames.ts` (lint `class-names-in-colocated-file`, `no-inline-class-name`) |
| Case 3 | A `__tests__/` folder | 0 across `src/`; specs sit beside their file |
| Case 4 | A `helpers/` or `utils/` folder | 0 under `src/components` (lint `no-helper-folder-in-components`) |
| Case 5 | A deployment constant | Never. `process.env.NEXT_PUBLIC_*` lives under `src/modules/` and is reached through the module that owns it. A component folder that reads the variable inline takes a default with it, so the same environment change acquires one home per folder that read it. The occurrences are in [the presentation sweep evidence](../../../tests/evidence/20260903-presentation-sweep.md) |

## Open question — currency and locale literals

A currency or locale literal is not a deployment constant. The formatter is built where the locale is
read, so the money literal sits in the connected half beside it, and the observations point that way
rather than towards a shared module — recorded in [the presentation sweep evidence](../../../tests/evidence/20260903-presentation-sweep.md). FE-FOLDER-6 Case 5
therefore covers deployment constants only, and whether a currency belongs to a money module of its
own is an owner decision this file does not make.

## Open question — extra files inside block folders

22 files under `src/components/blocks` fall outside the five canonical names: the
`blocks/profile/overview/` sub-tree (`OverviewCourses.tsx`, `SkillSnapshot.tsx`, `shared.ts`,
`useOverviewEvidence.ts`, …), `learn/CourseMockInterviewResultBlock/verdict.ts`,
`profile/ProfileCvBuilder/buildCvTexSource.ts`, and three `classNames.spec.ts`/`styles.spec.ts`.
No dominant convention exists for where a block-private helper module goes, so this file does not
legislate one.
