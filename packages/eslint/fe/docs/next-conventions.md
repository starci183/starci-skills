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

**Vì sao (why):** `<file>` dùng tên `middleware`. Từ Next 16 bộ chặn request là `proxy.ts` và xuất `proxy`.

**Cách sửa:** Đổi tên tệp thành `proxy.ts` và đổi export thành `proxy`.

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

**Vì sao (why):** Tệp `<file>` nằm dưới segment ngôn ngữ không phải `[locale]`. Chỉ có một mẫu: `next-intl`, `[locale]`, mặc định `vi`.

**Cách sửa:** Đổi tên thư mục segment thành `[locale]`.

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

**Vì sao (why):** `<file>` nhập một thư viện i18n thứ hai. App chỉ dùng `next-intl` qua `modules/i18n`.

**Cách sửa:** Chuyển sang `next-intl`; xóa thư viện còn lại.

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

**Vì sao (why):** `<html lang>` ở `<file>` là chữ cứng. Thuộc tính `lang` phải lấy từ segment `[locale]`.

**Cách sửa:** Dùng `lang={locale}` từ tham số của layout `[locale]`.

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

**Vì sao (why):** `<file>` là `page.tsx` nhưng không export `metadata` hoặc `generateMetadata`; mọi trang trong nhánh mang cùng một tiêu đề.

**Cách sửa:** Export `metadata` (hoặc `generateMetadata` khi tiêu đề lấy từ dữ liệu) với tiêu đề và mô tả lấy từ catalog thông điệp.

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

**Vì sao (why):** `<Suspense>` ở `<file>` có `fallback` rỗng: người dùng thấy khoảng trống thay vì trạng thái đang tải.

**Cách sửa:** Truyền skeleton (trạng thái loading) của đúng thứ đang tải làm `fallback`.

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

**Vì sao (why):** `<file>` nhập `Link`, `useRouter`, `usePathname` hoặc `redirect` từ Next, không biết locale: đường dẫn mất tiền tố `[locale]`.

**Cách sửa:** Nhập từ `modules/i18n/navigation`, được next-intl dựng từ `routing.ts`.

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

**Vì sao (why):** `<a>` ở `<file>` trỏ route nội bộ (tải lại cả trang, mất locale, mất prefetch) hoặc mở tab mới mà không có `rel`.

**Cách sửa:** Dùng `Link` từ `modules/i18n/navigation` với href dựng bởi `modules/routes`; liên kết `_blank` thêm `rel="noopener noreferrer"`.

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

**Vì sao (why):** `<file>` viết thẳng đường dẫn route ở nơi gọi; route đổi chỗ thì bản sao trỏ vào 404.

**Cách sửa:** Dựng href bằng hàm của `modules/routes` và dùng đúng hàm đó ở mọi nơi.

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
import { createAppI18n } from "@nivo/i18n"
export const i18n = createAppI18n({ locales: ["vi"] })
```

**Finding code:** `FE_I18N_PLACEMENT`

**Vì sao (why):** `<file>` tự dựng một tầng của stack next-intl (`defineRouting`, `createNavigation`, `getRequestConfig`, `createMiddleware`). Stack chỉ được viết một lần cho cả repo.

**Cách sửa:** Gọi factory `createAppI18n` của gói i18n dùng chung trong `modules/i18n/index.ts` và nhập kết quả; repo một app thì chỉ viết stack trong `modules/i18n` của app đó.
