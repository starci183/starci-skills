# Size and state budget

Law module: `size-and-state-budget.mjs`. Catalogue: R65 FE_SIZE_AND_STATE_BUDGET.

A component file is at most 300 lines; a connected unit holds at most 6 `useState` and reads at most 6 data hooks; there is no hand-written polling loop. `HFS_SIZE_GROWTH` (no growth against the parent commit) is the architecture machine's; these are the absolute file-local limits.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/component-line-budget`

A component file has at most 300 lines.

**Invalid** (`src/components/blocks/Feed/index.tsx`)

```ts
// a 301-line component file
```

**Valid** (`src/components/blocks/Feed/index.tsx`)

```ts
// 300 lines or fewer
```

**Finding code:** `FE_SIZE_AND_STATE_BUDGET`

**Why:** `<file>` is `<n>` lines long, over the 300-line limit for a component.

**Fix:** Separate rendering from data and split each region into its own unit.

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
