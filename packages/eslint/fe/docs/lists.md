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

**Vì sao (why):** Phần tử trả từ `.map` ở `<file>` không có `key`, nên React nhận diện hàng theo vị trí và hàng bị đổi state khi xoá hoặc sắp xếp lại.

**Cách sửa:** Thêm `key` lấy từ id của dữ liệu; với fragment dùng `<Fragment key={...}>`.

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

**Vì sao (why):** `key` ở `<file>` lấy từ chỉ số của `.map` hoặc giá trị sinh ngẫu nhiên; chỉ số là vị trí, không phải danh tính.

**Cách sửa:** Dùng id mà dữ liệu mang (`key={row.id}`); không dùng index, `Math.random`, `Date.now`.

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

**Vì sao (why):** Component trong `.map` ở `<file>` nhận object hoặc array literal làm prop: mỗi hàng mỗi lần render một giá trị mới, memo không bao giờ trúng.

**Cách sửa:** Nâng hằng số ra ngoài component hoặc dựng một lần trước `.map`.
