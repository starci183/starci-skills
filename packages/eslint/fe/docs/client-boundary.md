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

**Why:** `"use client"` in `<file>` (`<slot>` must not be a client component).

**Fix:** Put `"use client"` in the `index.tsx` of an interactive block, a leaf, or `error.tsx`/`global-error.tsx`; keep layouts and pages as server components.

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

**Why:** The client component at `<file>` imports code that exists only on the server (`server-only`, `next/headers`, Node modules, a server reader).

**Fix:** Read data in a server component or server reader and pass it down as props; or use SWR calling the app client.

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

**Why:** Module `<file>` imports server-only APIs (`next/headers`, `next/server`, `next-intl/server`, Node modules or a module that is already server-only) but does not begin with `import "server-only"`.

**Fix:** Make `import "server-only"` the first statement of the file; route files (`page`, `layout`, `route`, `proxy`) are already server components so they do not need it.

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

**Why:** `<file>` uses `localStorage`/`sessionStorage` outside `modules/`; storage does not exist on the server and throws when the quota is full.

**Fix:** Put reads/writes behind a hook or a guarded module in `modules/` (`typeof window`, try/catch) and call it from a block.

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

**Why:** `dangerouslySetInnerHTML` on `<tag>` in `<file>`: an arbitrary string becomes executable HTML.

**Fix:** Render content as elements; only a `<script>` carrying JSON-LD or theme code from an app constant may use it.

## `starci-fe/response-cookie-attributes`

A cookie written through Next's response cookies (`response.cookies.set`, `(await cookies()).set`, found by the method's declaring class `ResponseCookies` of `next`, never by a name) states `httpOnly` as a literal, carries `secure` and has `sameSite` `lax` or `strict`. The options are judged by their TYPE, so an `as const` constant and a spread of it (`{ ...SESSION_COOKIE_OPTIONS, maxAge: 0 }`) keep their literals (R107 `FE_COOKIE_ATTRIBUTES`).

**Invalid** (`src/app/api/session/route.ts`)

```ts
response.cookies.set(SESSION_COOKIE, token)
response.cookies.set(SESSION_COOKIE, token, { sameSite: "none", secure: true })
```

**Valid** (`src/app/api/session/route.ts`)

```ts
export const SESSION_COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax", path: "/", secure: SESSION_COOKIE_SECURE } as const
response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS)
```

**Finding code:** `FE_COOKIE_ATTRIBUTES`

**Why:** `<file>` writes a cookie without a literal `httpOnly`, without `secure`, or with `sameSite` other than `lax`/`strict`; a session cookie left to the defaults is readable by page script and rides cross-site requests.

**Fix:** Pass one `as const` options constant of the module that owns the cookie: `httpOnly: true` (`false` only for a preference page script reads), `secure` from `modules/config`, `sameSite` `lax` or `strict`.
