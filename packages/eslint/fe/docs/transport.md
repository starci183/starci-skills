# Transport, status and wire

Law module: `transport.mjs`. Catalogue: R50 FE_TRANSPORT_OWNER, R51 FE_HTTP_STATUS_COLLAPSE, R52 FE_WIRE_GENERATED.

One app, one client (`modules/api/client.ts`), one result vocabulary (`Outcome<T>`: `ok`, `refused`, `invalid`, `not-found`, `unavailable`). 401 and 403 become `refused`; nothing collapses a status into `null`; wire types are generated from the contract copy in `modules/api/contract/`.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/fetch-only-in-api-client`

The app's single `fetch` lives in `modules/api/client.ts`.

**Invalid** (`src/hooks/course/useCourse.ts`)

```ts
const r = await fetch(url)
```

**Valid** (`src/hooks/course/useCourse.ts`)

```ts
const r = await client.get(url)
```

**Finding code:** `FE_TRANSPORT_OWNER`

**Vì sao (why):** `fetch` (hoặc thư viện HTTP khác) ở `<file>` nằm ngoài `modules/api/client.ts`. Mỗi app chỉ có đúng một đường truyền.

**Cách sửa:** Gọi client của app và nhận `Outcome<T>`; không tự gọi `fetch`.

## `starci-fe/client-fetch-has-signal`

Every `fetch` in `modules/api/client.ts` passes an AbortSignal (timeout or caller).

**Invalid** (`src/modules/api/client.ts`)

```ts
fetch(url, { method: "GET" })
```

**Valid** (`src/modules/api/client.ts`)

```ts
fetch(url, { method: "GET", signal: AbortSignal.timeout(8000) })
```

**Finding code:** `FE_TRANSPORT_OWNER`

**Vì sao (why):** `fetch` ở `<file>` không có `signal`. Client bắt buộc có timeout và `AbortSignal`.

**Cách sửa:** Truyền `signal` (`AbortSignal.timeout(...)` kết hợp với tín hiệu của người gọi).

## `starci-fe/no-shared-transport-state`

`modules/api/**` holds no module-level `let`/`var`.

**Invalid** (`src/modules/api/client.ts`)

```ts
let token = null
```

**Valid** (`src/modules/api/client.ts`)

```ts
export const request = (token: string) => token
```

**Finding code:** `FE_TRANSPORT_OWNER`

**Vì sao (why):** `<file>` giữ trạng thái dùng chung dạng `let`/`var` trong tầng API. Token và locale không được nằm trong singleton.

**Cách sửa:** Truyền credential và locale bằng tham số hoặc context.

## `starci-fe/client-maps-auth-to-refused`

`modules/api/client.ts` handles 401 and 403 and produces `refused`.

**Invalid** (`src/modules/api/client.ts`)

```ts
const r = await fetch(u, { signal })
```

**Valid** (`src/modules/api/client.ts`)

```ts
const r = await fetch(u, { signal })
if (r.status === 401 || r.status === 403) return { kind: "refused" }
```

**Finding code:** `FE_HTTP_STATUS_COLLAPSE`

**Vì sao (why):** Client ở `<file>` không đổi 401/403 thành `refused`, nên trạng thái "cần đăng nhập" không bao giờ đạt được.

**Cách sửa:** Thêm nhánh 401/403 trả `{ kind: "refused" }` trong client.

## `starci-fe/no-http-status-collapse`

A non-ok response is not folded into one branch or into null; 401/403 become `refused`.

**Invalid** (`src/modules/api/client.ts`)

```ts
if (!res.ok) return null
```

**Valid** (`src/modules/api/client.ts`)

```ts
if (!res.ok) return toOutcome(res.status)
```

**Finding code:** `FE_HTTP_STATUS_COLLAPSE`

**Vì sao (why):** `<file>` gộp mọi mã HTTP thành một nhánh (hoặc trả null khi phản hồi lỗi). 401/403 phải thành `refused`.

**Cách sửa:** Trả `Outcome` theo mã: `refused` (401/403), `not-found`, `invalid`, `unavailable`; không trả nguyên văn lỗi của server làm lý do.

## `starci-fe/no-hand-typed-wire`

Wire types come from the contract copy via codegen; responses are not cast.

**Invalid** (`src/modules/api/course/read-course.ts`)

```ts
const x = (await res.json()) as Course
```

**Valid** (`src/modules/api/course/read-course.ts`)

```ts
import type { CourseQuery } from "../__generated__/graphql"
```

**Finding code:** `FE_WIRE_GENERATED`

**Vì sao (why):** `<file>` tự gõ kiểu wire hoặc ép kiểu phản hồi. Dùng kiểu sinh từ `contract/`.

**Cách sửa:** Chạy codegen từ bản sao hợp đồng ở `modules/api/contract/` và nhập kiểu sinh ra; đưa tài liệu GraphQL vào tệp `.graphql`.

## `starci-fe/outcome-kinds-exhaustive`

A `switch` over an Outcome's `kind` has a case for every kind (catalogue R51, sub-check `FE_OUTCOME_KIND_UNHANDLED`).

**Invalid** (`src/hooks/course/useCourse.ts`)

```tsx
switch (outcome.kind) { case "ok": return outcome.data; default: return null }
```

**Valid** (`src/hooks/course/useCourse.ts`)

```tsx
switch (outcome.kind) {
  case "ok": return outcome.data
  case "refused": return goToSignIn()
  case "invalid": return showIssues(outcome.issues)
  case "not-found": return notFoundState()
  case "unavailable": return retryState(outcome.retryable)
}
```

**Finding code:** `FE_OUTCOME_KIND_UNHANDLED`

**Vì sao (why):** `switch` trên `kind` ở `<file>` có nhánh `ok` nhưng thiếu một trong refused, invalid, not-found, unavailable.

**Cách sửa:** Viết đủ năm nhánh của `Outcome<T>`, mỗi nhánh một màn; không dựa vào `default`.
