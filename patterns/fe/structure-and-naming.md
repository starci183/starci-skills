# Folder structure and naming (FE)

> Scope: how to ORGANISE files and folders and how to NAME components, hooks, and types in
> `src/components` — not design or UI rules. Grounded entirely in the repo's real code.

---

## 1. One component, one folder, one `index.tsx`

Every component lives in its own folder, with the code in `index.tsx` — never as a loose `.tsx`
named after the component sitting in the parent folder. The folder is PascalCase and its name is the
name of the exported component. The repo holds 764 `index.tsx` files following exactly this rule.

```
blocks/cards/LabeledCard/index.tsx   →  export const LabeledCard = (...)
```

Two shapes to reject:

```
blocks/cards/LabeledCard.tsx                 // a component must not sit loose
blocks/cards/LabeledCard/LabeledCard.tsx     // do not repeat the name; use index.tsx
```

The rare exception — a loose file at the same level — is for a plain container helper such as
`src/components/drawers/DrawerContainer.tsx`. A real component still gets folder-plus-index.

---

## 2. A sub-component is a nested folder inside its parent

When a component splits, EACH part becomes its own PascalCase folder with an `index.tsx`, nested
inside the parent; the parent's `index.tsx` composes them through relative imports of `./ChildName`.

```
src/components/features/course/CourseDetail/
  index.tsx                    // composes
  CourseHero/index.tsx
  CoursePricingRail/index.tsx
  CourseFaq/index.tsx
```

```tsx
// CourseDetail/index.tsx
import { CourseHero } from "./CourseHero"
import { CoursePricingRail } from "./CoursePricingRail"
```

A sub-component reaches a sibling, or the parent's barrel, by relative path
(`src/components/features/careers/Headhunting/Headhuntings/ConsultantCard/index.tsx`):

```tsx
import { ConsultantAvatar } from "../ConsultantAvatar"     // sibling
import { useOpenHeadhunterDetail } from "../../hooks"      // the parent's barrel
```

Two shapes to reject: several components crammed into one `index.tsx`, and a sub-component written
as a flat `CourseHero.tsx` sitting beside `index.tsx`.

---

## 3. Category at the top level

`src/components/` is split by ROLE, never flat:

- `blocks/` — reusable blocks, split further by family: `cards/ chips/ form/ lists/ navigation/
  layout/ stats/ skeleton/ feedback/ …`
- `features/` — UI belonging to a DOMAIN, grouped by that domain: `features/careers/…`,
  `features/course/…`, `features/learn/…`
- `modals/` and `drawers/` — overlays (see §6)
- `layouts/ providers/ svg/ utils/ reuseable/`

A shared block goes to `src/components/blocks/cards/PressableCard/`; UI belonging to one domain goes
to `src/components/features/careers/Headhunting/`.

Two placements to reject: a feature-specific component dropped into `blocks/`, and a new component
thrown straight into `src/components/` without a category.

---

## 4. Companion folders for a large component: `hooks/ types/ utils/` plus a barrel

When one component grows several hooks, types, or utils, split them into `hooks/`, `types/`, and
`utils/` folders INSIDE the component's own folder, each with an `index.ts` barrel that does nothing
but `export * from "./x"`. Constants go in `constants.ts`; a handful of types can stay in a flat
`types.ts`.

```
src/components/features/careers/Headhunting/
  hooks/index.ts          →  export * from "./useOpenHeadhunterDetail"
  hooks/useHeadhuntingCompanyDetail.ts
  types/index.ts          →  export * from "./breadcrumbs"
  utils/index.ts          →  export * from "./resolveConsultantAvatar"
```

For a small or local set of types, one flat file is right:
`src/components/features/course/CourseDetail/types.ts`, `constants.ts`.

Two shapes to reject: a barrel `index.ts` that holds logic, and `useX.ts` files scattered beside
`index.tsx` once there are enough hooks to deserve a `hooks/` folder.

---

## 5. Naming: hooks are `use*`, props are `<Component>Props`, exports are NAMED

- **Hook**: a camelCase file starting with `use` — `useCourseTotals.ts`,
  `useHeadhuntingsBreadcrumbs.ts` (`src/components/features/course/CourseDetail/hooks/`).
- **Props**: `interface <Component>Props` (or a `type`), EXPORTED, extending `WithClassNames`.
- **Component**: a **named export** whose name matches the folder. This is the dominant idiom —
  743 of 764. `export default` is the minority (~21 files, and always ALONGSIDE a named export);
  default-only is not written here.

```tsx
// src/components/blocks/cards/LabeledCard/index.tsx
export interface LabeledCardProps extends WithClassNames<undefined> { label: ReactNode /* … */ }
export const LabeledCard = ({ label, className }: LabeledCardProps) => { /* … */ }
```

When the props add no fields of their own, alias `WithClassNames<undefined>`
(`src/components/.../Headhuntings/index.tsx`):

```tsx
export type HeadhuntingsProps = WithClassNames<undefined>
```

Three shapes to reject:

```tsx
export default function labeledCard(props) {}   // default-only, and a lowercase name
const Props = {}                                // props not named <Component>Props, not exported
function useData() {}                           // a hook outside hooks/, in a file not named useX.ts
```

---

## 6. Overlays: `modals/` and `drawers/`, with the suffix

Modals live in `src/components/modals/`, each in a folder suffixed `Modal` (`AuthenticationModal/`,
`GlobalSearchModal/`). Drawers live in `src/components/drawers/`, suffixed `Drawer`
(`MiniCartDrawer/`, `E2eResultDrawer/`). Both still follow the one-folder-`index.tsx` rule from §1.

Correct: `src/components/modals/AiQuotaModal/index.tsx`,
`src/components/drawers/SubmissionResultHistoryDrawer/index.tsx`.

Two shapes to reject: `AiQuotaOverlay/`, which drops the `Modal` suffix, and a modal parked in
`features/` instead of `modals/`.

---

## 7. A deprecated alias is a re-export beside the new one

When a component is renamed, KEEP the old name as a re-export marked `@deprecated`. Do not delete it
and break every import.

```tsx
// src/components/features/careers/Headhunting/Headhuntings/index.tsx
export const Headhuntings = (...) => { /* … */ }

/** @deprecated Use {@link Headhuntings}. */
export const HeadhuntingsLearnLayout = Headhuntings
```
