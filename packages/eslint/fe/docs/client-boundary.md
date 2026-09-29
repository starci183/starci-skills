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

## `starci-fe/client-no-server-import`

A `"use client"` file does not import `server-only`, `next/headers`, a Node built-in or a server reader (sub-check `FE_CLIENT_SERVER_IMPORT`).

**Invalid** (`src/components/blocks/Feed/index.tsx`)

```tsx
"use client"
import { cookies } from "next/headers"
```

**Valid** (`src/components/blocks/Feed/index.tsx`)

```tsx
"use client"
import useSWR from "swr"
```

**Finding code:** `FE_CLIENT_SERVER_IMPORT`

**Vì sao (why):** Client component ở `<file>` nhập mã chỉ tồn tại ở server (`server-only`, `next/headers`, module Node, server reader).

**Cách sửa:** Đọc dữ liệu ở server component hoặc server reader rồi truyền xuống bằng props; hoặc dùng SWR gọi client của app.

## `starci-fe/web-storage-only-in-modules`

`localStorage` and `sessionStorage` are touched only inside `modules/` (sub-check `FE_STORAGE_OUTSIDE_MODULES`).

**Invalid** (`src/components/blocks/Wallet/index.tsx`)

```tsx
const raw = sessionStorage.getItem(KEY)
```

**Valid** (`src/components/blocks/Wallet/index.tsx`)

```tsx
const draft = useTopUpDraft()
```

**Finding code:** `FE_STORAGE_OUTSIDE_MODULES`

**Vì sao (why):** `<file>` dùng `localStorage`/`sessionStorage` ngoài `modules/`; storage không có ở server và ném lỗi khi đầy hạn mức.

**Cách sửa:** Đặt đọc/ghi sau một hook hoặc module trong `modules/` có bảo vệ (`typeof window`, try/catch) rồi gọi từ block.

## `starci-fe/no-dangerous-html`

`dangerouslySetInnerHTML` only on `<script>`; never on a visible element (sub-check `FE_DANGEROUS_HTML`).

**Invalid** (`src/components/blocks/Feed/component.tsx`)

```tsx
<div dangerouslySetInnerHTML={{ __html: html }} />
```

**Valid** (`src/components/blocks/Feed/component.tsx`)

```tsx
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD }} />
```

**Finding code:** `FE_DANGEROUS_HTML`

**Vì sao (why):** `dangerouslySetInnerHTML` trên `<tag>` ở `<file>`: chuỗi bất kỳ trở thành HTML chạy được.

**Cách sửa:** Render nội dung thành phần tử; chỉ `<script>` mang JSON-LD hoặc mã theme từ hằng số của app mới được dùng.
