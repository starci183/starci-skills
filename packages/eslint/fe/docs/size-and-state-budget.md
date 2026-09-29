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

**Vì sao (why):** `<file>` dài `<n>` dòng, vượt ngưỡng 300 dòng của một component.

**Cách sửa:** Tách phần vẽ khỏi phần dữ liệu và tách từng khu vực thành đơn vị riêng.

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

**Vì sao (why):** `<unit>` có `<n>` hook dữ liệu / `<m>` useState, vượt ngưỡng 6.

**Cách sửa:** Gom trạng thái đổi cùng nhau vào reducer hoặc hook riêng; tách mỗi vùng dữ liệu thành block kết nối riêng.

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

**Vì sao (why):** `<unit>` tự viết vòng poll (`setInterval` hoặc `setTimeout` tự gọi lại).

**Cách sửa:** Làm tươi qua hook dữ liệu (`refreshInterval`) hoặc socket, mỗi resource đúng một cơ chế.
