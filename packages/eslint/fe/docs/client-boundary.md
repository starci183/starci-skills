# Client boundary

Law module: `client-boundary.mjs`. Catalogue: R55 FE_CLIENT_BOUNDARY.

Server first. `"use client"` appears only on the `index.tsx` of an interactive block (or overlay), on a leaf whose interaction is intrinsic, on a branch or leaf of a workspace package (`packages/<pkg>/src/{branches,leaves}/`, where the grammar tiers sit directly under `src/`), and on `error.tsx` / `global-error.tsx`, which Next requires to be client components. Routes, pages and layouts are server components.

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

A `"use client"` file does not import `server-only`, `next/headers`, `next/server`, `next-intl/server`, a Node built-in or a server reader (sub-check `FE_CLIENT_SERVER_IMPORT`).

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

## `starci-fe/server-module-marks-server-only`

A module that imports `next/headers`, `next/server` (a value import), `next-intl/server`, a Node built-in, or a module that is itself server-only starts with `import "server-only"` (sub-check `FE_SERVER_ONLY_MARK`). A module is server-only when the TypeScript module resolution of the import specifier reaches a source file whose first statement is `import "server-only"`; `import type` and `import { type X }` carry no runtime and are not judged. Route files are server components by construction and need no marker: they are recognized by their slot (`fe.route`, `fe.source-root-pinned`), not by their name. A `"use client"` file that imports the server is `client-no-server-import`'s finding. The multi-hop client reachability (a client block reaching a marked module through a hook) is the architecture machine's.

**Invalid** (`src/modules/api/courses/read-courses.ts`)

```ts
import { headers } from "next/headers"
export const readCourses = async () => (await headers()).get("x-locale")
```

**Valid** (`src/modules/api/courses/read-courses.ts`)

```ts
import "server-only"
import { headers } from "next/headers"
export const readCourses = async () => (await headers()).get("x-locale")
```

**Finding code:** `FE_SERVER_ONLY_MARK`

**Vì sao (why):** Module `<file>` nhập API chỉ có ở server (`next/headers`, `next/server`, `next-intl/server`, module Node hoặc module đã là server-only) nhưng không mở đầu bằng `import "server-only"`.

**Cách sửa:** Đặt `import "server-only"` làm câu lệnh đầu tiên của tệp; tệp route (`page`, `layout`, `route`, `proxy`) là server component sẵn nên không cần.

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
