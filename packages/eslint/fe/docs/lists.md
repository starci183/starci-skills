# Lists

Law module: `lists.mjs`. Catalogue: R65 FE_SIZE_AND_STATE_BUDGET, sub-check `FE_LIST_KEY`.

A list is items with identity. React reconciles a rendered list by `key`; a missing, positional or random key hands a deleted row's state to its neighbour or remounts every row. A component prop written as an object or array literal inside `.map` is a new value per row per render, so a memoised row never hits.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/list-item-has-key`

Every element a `.map` callback returns carries a `key`.

**Invalid** (`src/components/blocks/Feed/component.tsx`)

```tsx
rows.map((row) => <Row row={row} />)
```

**Valid** (`src/components/blocks/Feed/component.tsx`)

```tsx
rows.map((row) => <Row key={row.id} row={row} />)
```

**Finding code:** `FE_LIST_KEY`

**Why:** An element returned from `.map` in `<file>` has no `key`, so React identifies rows by position and rows swap state when removed or reordered.

**Fix:** Add a `key` taken from the data id; for a fragment use `<Fragment key={...}>`.

## `starci-fe/no-index-key`

A list key is stable data identity, never the map index or a random value. A static array written in place, or a callback that ignores its item (`(_, index) =>`), is exempt.

**Invalid** (`src/components/blocks/Feed/component.tsx`)

```tsx
rows.map((row, index) => <Row key={index} row={row} />)
```

**Valid** (`src/components/blocks/Feed/component.tsx`)

```tsx
rows.map((row) => <Row key={row.id} row={row} />)
```

**Finding code:** `FE_LIST_KEY`

**Why:** The `key` in `<file>` comes from the `.map` index or a randomly generated value; an index is a position, not an identity.

**Fix:** Use the id the data carries (`key={row.id}`); do not use index, `Math.random`, `Date.now`.

## `starci-fe/no-inline-literal-prop-in-list`

No object or array literal as a prop of a component rendered inside `.map`.

**Invalid** (`src/components/blocks/Feed/component.tsx`)

```tsx
rows.map((row) => <Avatar key={row.id} props={{ size: "sm" }} />)
```

**Valid** (`src/components/blocks/Feed/component.tsx`)

```tsx
const AVATAR_PROPS = { size: "sm" } as const
rows.map((row) => <Avatar key={row.id} props={AVATAR_PROPS} />)
```

**Finding code:** `FE_LIST_KEY`

**Why:** A component inside `.map` in `<file>` receives an object or array literal as a prop: every row gets a new value on every render, so memo never hits.

**Fix:** Hoist the constant out of the component or build it once before `.map`.
