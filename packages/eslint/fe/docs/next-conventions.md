# Next conventions and the one locale pattern

Law module: `next-conventions.mjs`. Catalogue: FE_NEXT_CONVENTIONS, R58 (html lang), R59 (i18n placement, single-file half).

One locale pattern everywhere: `next-intl`, a `[locale]` segment, default `vi`, `localePrefix: "as-needed"`, and `proxy.ts` (Next 16) instead of `middleware.ts`.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/no-middleware-file`

`middleware.ts` is forbidden: the request interceptor is `proxy.ts` and exports `proxy`.

**Invalid** (`src/middleware.ts`)

```ts
export function middleware() {}
```

**Valid** (`src/proxy.ts`)

```ts
export function proxy(request) { return request }
```

**Finding code:** `FE_NEXT_CONVENTIONS`

**Why:** `<file>` uses the name `middleware`. Since Next 16 the request interceptor is `proxy.ts` and exports `proxy`.

**Fix:** Rename the file to `proxy.ts` and rename the export to `proxy`.

## `starci-fe/locale-segment-is-locale`

The locale route segment is `[locale]`, never `[lang]`.

**Invalid** (`src/app/[lang]/page.tsx`)

```ts
export default function Page() {}
```

**Valid** (`src/app/[locale]/page.tsx`)

```ts
export default function Page() {}
```

**Finding code:** `FE_I18N_PLACEMENT`

**Why:** The file `<file>` sits under a language segment that is not `[locale]`. There is only one pattern: `next-intl`, `[locale]`, default `vi`.

**Fix:** Rename the segment directory to `[locale]`.

## `starci-fe/no-second-i18n-stack`

`next-intl` is the only i18n library.

**Invalid** (`any file`)

```ts
import { useTranslation } from "react-i18next"
```

**Valid** (`any file`)

```ts
import { useTranslations } from "next-intl"
```

**Finding code:** `FE_I18N_PLACEMENT`

**Why:** `<file>` imports a second i18n library. The app uses only `next-intl` through `modules/i18n`.

**Fix:** Switch to `next-intl`; remove the other library.

## `starci-fe/html-lang-from-locale`

`<html lang>` is taken from the `[locale]` segment, never a literal.

**Invalid** (`src/app/[locale]/layout.tsx`)

```ts
<html lang="en">
```

**Valid** (`src/app/[locale]/layout.tsx`)

```ts
<html lang={locale}>
```

**Finding code:** `FE_I18N_LITERAL`

**Why:** `<html lang>` in `<file>` is hardcoded. The `lang` attribute must come from the `[locale]` segment.

**Fix:** Use `lang={locale}` from the parameters of the `[locale]` layout.

## `starci-fe/page-exports-metadata`

Every `page.tsx` exports `metadata` or `generateMetadata` (catalogue R54, sub-check `FE_PAGE_METADATA_MISSING`).

**Invalid** (`src/app/[locale]/courses/page.tsx`)

```tsx
export default function Page() { return <CoursesPage /> }
```

**Valid** (`src/app/[locale]/courses/page.tsx`)

```tsx
export async function generateMetadata() { return { title: t("courses.title") } }
export default function Page() { return <CoursesPage /> }
```

**Finding code:** `FE_PAGE_METADATA_MISSING`

**Why:** `<file>` is a `page.tsx` but does not export `metadata` or `generateMetadata`; every page in the branch carries the same title.

**Fix:** Export `metadata` (or `generateMetadata` when the title comes from data) with the title and description taken from the message catalog.

## `starci-fe/no-null-suspense-fallback`

`<Suspense>` has a fallback that renders something; `fallback={null}` is forbidden (catalogue R53, sub-check `FE_SUSPENSE_NULL_FALLBACK`).

**Invalid** (`src/components/blocks/Feed/component.tsx`)

```tsx
<Suspense fallback={null}><Feed /></Suspense>
```

**Valid** (`src/components/blocks/Feed/component.tsx`)

```tsx
<Suspense fallback={<FeedSkeleton />}><Feed /></Suspense>
```

**Finding code:** `FE_SUSPENSE_NULL_FALLBACK`

**Why:** `<Suspense>` in `<file>` has an empty `fallback`: the user sees a blank space instead of a loading state.

**Fix:** Pass the skeleton (loading state) of exactly what is loading as the `fallback`.

## `starci-fe/navigation-from-intl`

`Link`, `useRouter`, `usePathname` and `redirect` come from `modules/i18n/navigation`, not from Next (catalogue R59, sub-check `FE_I18N_NAVIGATION`).

**Invalid** (`src/components/blocks/Feed/component.tsx`)

```tsx
import { useRouter } from "next/navigation"
```

**Valid** (`src/components/blocks/Feed/component.tsx`)

```tsx
import { useRouter } from "@/modules/i18n/navigation"
```

**Finding code:** `FE_I18N_NAVIGATION`

**Why:** `<file>` imports `Link`, `useRouter`, `usePathname` or `redirect` from Next, which is unaware of the locale: paths lose the `[locale]` prefix.

**Fix:** Import from `modules/i18n/navigation`, which next-intl builds from `routing.ts`.

## `starci-fe/no-native-anchor`

An internal link is `Link` from `modules/i18n/navigation`; an external `_blank` link carries `rel` (catalogue R59, sub-check `FE_I18N_NAVIGATION`).

**Invalid** (`src/components/blocks/Feed/component.tsx`)

```tsx
<a href="/courses">{t("courses")}</a>
```

**Valid** (`src/components/blocks/Feed/component.tsx`)

```tsx
<Link href={routes.courses()}>{t("courses")}</Link>
```

**Finding code:** `FE_I18N_NAVIGATION`

**Why:** `<a>` in `<file>` points at an internal route (reloads the whole page, loses the locale, loses prefetch) or opens a new tab without `rel`.

**Fix:** Use `Link` from `modules/i18n/navigation` with an href built by `modules/routes`; for `_blank` links add `rel="noopener noreferrer"`.

## `starci-fe/no-hardcoded-route`

A route path is built by `modules/routes`, never written as a literal at a link or a navigation call (catalogue R57, sub-check `FE_ROUTE_HARDCODED`).

**Invalid** (`src/components/blocks/Feed/component.tsx`)

```tsx
router.push("/agentos/workspaces/new")
```

**Valid** (`src/components/blocks/Feed/component.tsx`)

```tsx
router.push(routes.newWorkspace())
```

**Finding code:** `FE_ROUTE_HARDCODED`

**Why:** `<file>` writes a route path directly at the call site; when the route moves, the copy points at a 404.

**Fix:** Build the href with a function from `modules/routes` and use that same function everywhere.

## `starci-fe/i18n-stack-in-one-module`

next-intl's routing, navigation, request config and middleware factories are called only in the i18n package (or the only app's `modules/i18n`).

`defineRouting` (`next-intl/routing`), `createNavigation` (`next-intl/navigation`), `getRequestConfig` (`next-intl/server`) and `createMiddleware` (`next-intl/middleware`), resolved by the import that binds the called name (a renamed import or a namespace member counts), are called only in a file of slot `fe.package.i18n` (`packages/<family>-i18n`, exporting `createAppI18n`), or in a `fe.modules.i18n` file of a repository that declares exactly one app. In a multi-app repository each app's `modules/i18n` calls the package factory. It sits beside `no-second-i18n-stack`, which refuses another i18n library at its import; this rule refuses a second copy of next-intl's own stack.

**Invalid** (`apps/web/src/modules/i18n/request.ts`, a repository with two apps)

```ts
import { getRequestConfig } from "next-intl/server"
export default getRequestConfig(async () => ({ locale: "vi", messages: {} }))
```

**Valid** (`apps/web/src/modules/i18n/index.ts`)

```ts
import { createAppI18n } from "@acme/i18n"
export const i18n = createAppI18n({ locales: ["vi"] })
```

**Finding code:** `FE_I18N_PLACEMENT`

**Why:** `<file>` builds a layer of the next-intl stack itself (`defineRouting`, `createNavigation`, `getRequestConfig`, `createMiddleware`). The stack may be written only once per repo.

**Fix:** Call the `createAppI18n` factory of the shared i18n package in `modules/i18n/index.ts` and import the result; in a single-app repo, write the stack only in that app's `modules/i18n`.
