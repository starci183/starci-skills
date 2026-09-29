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
