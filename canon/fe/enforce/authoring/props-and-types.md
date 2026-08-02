# Props and types — STRICT

Scope: how to DECLARE props and types for an FE component (`<fe>/src/components` — `<fe>` =
`node .claude/scripts/read-workspace-context.mjs fe.path`) — not design. Grounded entirely in real source.

## 1. `WithClassNames<T>` — the ONLY way to accept a className

Imported from `@/modules/types/base/class-name` (669 files, re-measured 2026-07-31):

```ts
export interface WithClassNames<T> {
    classNames?: T      // per-child-slot classes
    className?: string  // class for the root
}
```

- **A component that styles only its root** → `WithClassNames<undefined>`:

```ts
// src/components/blocks/async/EmptyContent/index.tsx
export interface EmptyContentProps extends WithClassNames<undefined> { … }
```

- **A component with child slots that need their own override** → pass an object shape where EVERY
  key names a real slot:

```ts
// src/components/blocks/chips/TagChips/index.tsx
export interface TagChipsProps extends WithClassNames<{
    trigger: string
    content: string
}> { … }
```

- Never declare `className?: string` by hand in an interface. Never
  `classNames: Record<string, string>` — the slots must be listed.
- The root is ALWAYS merged with `cn(base, className)` — see [[react-idioms]].

## 2. `type` vs `interface` for `XxxProps` — a hard convention

The boundary in this repo (365 `interface … extends`, 264 `type …`):

- **`interface XxxProps extends WithClassNames<…>`** when the component has props OF ITS OWN — an
  object shape you are declaring. This is the default.
- **`type XxxProps = <expression>`** ONLY when the props are a single type expression rather than an
  object literal you build:
  - a plain alias: `export type BrandLogoProps = WithClassNames<undefined>` (`blocks/identity/BrandLogo`)
  - an intersection: `export type GradeModelDropdownProps = WithClassNames<undefined> & { … }` (`blocks/grading/GradeModelDropdown`)
  - no props at all: `export type PracticeProblemProps = Record<string, never>` (`features/practice/PracticeProblem`)
- Do not write `type XxxProps = { … }` for an ordinary props object — use `interface`. Do not
  wrap a single alias or union in an `interface`.

## 3. JSDoc — EVERY prop, EVERY component

- **STRICT**: one `/** … */` line per prop saying what it does, its default, and when it hides or
  falls back. Write the default as `@default 3` (see `TagChipsProps.maxVisible`). A prop with
  complex behaviour gets a multi-line JSDoc explaining WHEN to use it.
- The component opens with a JSDoc block: its role, whether it is pure or a container, what it
  composes, and `@param props - {@link XxxProps}` (see `Headhuntings`, `TagChips`).
- Secondary interfaces — item, group, and so on — get JSDoc too.
- A bare prop with no JSDoc is out of standard, including an "obvious" one.

## 4. Types — hard conventions

- **`Array<T>`, never `T[]`**: `tags: Array<string>`; `ReadonlyArray<OverlayKey>` for an immutable
  constant.
- **`import type`** for every type-only import:
  `import type { WithClassNames } from "@/modules/types/base/class-name"`. Mixing is allowed:
  `import { type Key, type ReactNode } from "react"`.
- **No `any`** — including `as any`. To loosen a type, reach for a generic, a union, or
  `Awaited<ReturnType<typeof fn>>`; to borrow a vendor primitive's prop type,
  `variant?: React.ComponentProps<typeof Chip>["variant"]` (real example: `TagChips`).
- A narrow union beats a blind boolean: `size?: "sm" | "md"`, `variant?: "primary" | "secondary"` —
  with the default in JSDoc and in the destructure (`size = "md"`).
- A discriminated union for a payload with several branches, fields `readonly`:

```ts
// zustand/overlay/store.ts
export type PendingCartIntent =
    | { readonly type: "add"; readonly courseId: string }
    | { readonly type: "open" }
```

- Nullable from the API: `avatar?: string | null` — keep the `| null` when the backend really
  returns null; do not flatten it to `undefined`.
- A render slot is `ReactNode` (`trailing?: ReactNode`), never `JSX.Element`.

## 5. A container reads the store or SWR itself — no prop-drilling data or callbacks

A "feature" or "container" component owns its data and its orchestration: it reads SWR, Redux, or
zustand directly in its body rather than receiving a list or a handler as a prop from above.

```ts
// src/components/features/careers/Headhunting/Headhuntings/index.tsx
export type HeadhuntingsProps = WithClassNames<undefined>   // NO data prop
export const Headhuntings = ({ className }: HeadhuntingsProps) => {
    const companies = useQueryHeadhunterCompaniesSwr()       // the container reads for itself
    const consultants = useAppSelector(...)                  // straight from the store
    // … renders the presentational <ConsultantGrid/> with that data
}
```

- A container usually `extends WithClassNames<undefined>` — it takes only `className` — and then
  self-fetches.
- No prop-drilling: `<Headhuntings data={list} onSelect={…} refetch={…} />` when the container is
  perfectly able to read SWR or the store itself. A callback passed down to a PRESENTATIONAL child
  is fine; what is forbidden is pumping data and callbacks through several layers instead of
  letting the lower layer read the store.
- A pure block (`blocks/`) is the REVERSE: it receives all its data as props and never touches SWR
  or the store. That boundary between container and block is what keeps both readable.
- Say which one it is in the component's JSDoc — `Container — owns data`, or presentational (see
  `Headhuntings`).

## 6. Destructure props in the signature, with defaults in place

```ts
// src/components/blocks/chips/TagChips/index.tsx
export const TagChips = ({ tags, maxVisible = 3, variant = "soft", classNames }: TagChipsProps) => {
// Wrong: (props) => { const { tags } = props … }   · Wrong: props.tags scattered through the body
```
