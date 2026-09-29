# Client boundary

Law module: `client-boundary.mjs`. Catalogue: R55 FE_CLIENT_BOUNDARY.

Server first. `"use client"` appears only on the `index.tsx` of an interactive block (or overlay), on a leaf whose interaction is intrinsic, and on `error.tsx` / `global-error.tsx`, which Next requires to be client components. Routes, pages and layouts are server components.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/use-client-only-at-boundary`

`"use client"` appears only at a block index, a leaf, or a Next error boundary.

**Invalid** (`src/app/[locale]/layout.tsx`)

```ts
"use client"
export default function Layout() { return null }
```

**Valid** (`src/components/blocks/Feed/index.tsx`)

```ts
"use client"
export const Feed = () => null
```

**Finding code:** `FE_CLIENT_BOUNDARY`

**Vì sao (why):** `"use client"` ở `<file>` (`<slot>` không được là client component).

**Cách sửa:** Đặt `"use client"` ở `index.tsx` của block có tương tác, leaf, hoặc `error.tsx`/`global-error.tsx`; giữ layout và page là server component.
