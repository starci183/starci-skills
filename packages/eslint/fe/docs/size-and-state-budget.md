# Size and state budget

Law module: `size-and-state-budget.mjs`. Catalogue: R65 FE_SIZE_AND_STATE_BUDGET.

A drawing file is at most 300 lines, a connected `index.tsx` at most 200, and a hook implementation at most 200. A pure re-export `index.ts` has a separate 400-line budget. A connected unit holds at most 6 `useState` and reads at most 6 data hooks; there is no hand-written polling loop. `HFS_SIZE_GROWTH` (no growth against the parent commit) is the architecture machine's; these are the absolute file-local limits.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/component-line-budget`

A file stays within the budget of its HFS slot: `component.tsx` 300 lines, connected `index.tsx` 200, hook implementation 200, module 400. Where the slot states `budget.barrel`, an `index.ts` containing only `export ... from` statements uses that separate 400-line limit. Named, type-only, star and namespace re-exports qualify, including multiline statements and comments. Imports, declarations, local exports, directives and empty statements keep the ordinary limit, as does an empty statement body. Another basename or `index.tsx` keeps its ordinary limit. The rule reads every limit from `knowledge/hfs/slots.yaml`; a trailing newline does not add a line.

**Invalid** (`src/components/blocks/Feed/index.tsx`)

```ts
// a 201-line connected entry
```

**Valid** (`src/components/blocks/Feed/index.tsx`)

```ts
// 200 lines or fewer
```

**Finding code:** `FE_SIZE_AND_STATE_BUDGET`

**Why:** `<file>` is `<n>` lines long, over the limit its slot states for the file's role or its pure re-export barrel.

**Fix:** Split an oversized implementation by responsibility; narrow a barrel's public surface to the exports its owner needs.

## `starci-fe/unit-hook-budget`

A unit has at most 6 state hooks and 6 data hooks.

**Invalid** (`src/components/blocks/Feed/index.tsx`)

```ts
const Feed = () => { /* 7 x useState */ }
```

**Valid** (`src/components/blocks/Feed/index.tsx`)

```ts
const Feed = () => { /* up to 6 x useState and 6 data hooks */ }
```

**Finding code:** `FE_SIZE_AND_STATE_BUDGET`

**Why:** `<unit>` has `<n>` data hooks / `<m>` useState, over the limit of 6.

**Fix:** Group state that changes together into a reducer or a dedicated hook; split each data region into its own connected block.

## `starci-fe/no-hand-rolled-polling`

No `setInterval` and no self-scheduling `setTimeout`: one refresh mechanism per resource.

**Invalid** (`src/components/blocks/Feed/index.tsx`)

```ts
useEffect(() => { const t = setInterval(load, 5000) }, [])
```

**Valid** (`src/components/blocks/Feed/index.tsx`)

```ts
const d = useQueryFeedSwr({ refreshInterval: 5000 })
```

**Finding code:** `FE_SIZE_AND_STATE_BUDGET`

**Why:** `<unit>` writes its own poll loop (`setInterval` or a self-calling `setTimeout`).

**Fix:** Refresh through a data hook (`refreshInterval`) or a socket, exactly one mechanism per resource.
