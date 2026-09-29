# Runtime hygiene

Law module: `hygiene.mjs`. Catalogue: R65 FE_SIZE_AND_STATE_BUDGET (sub-checks `FE_EFFECT_CLEANUP`, `FE_SWALLOWED_ERROR`, `FE_CONSOLE_CALL`) and R50 FE_TRANSPORT_OWNER (sub-check `FE_EFFECT_FETCH`).

Work started by a component that nobody owns the end of: a timer that outlives the component, a fetch in an effect with no cache or cancel, an empty `catch` that hides the failure, a `console` call no pipeline reads. `modules/**` is exempt from the timer rule only (the API client owns its timeout timer and clears it in `finally`).

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/timer-needs-effect-cleanup`

`setTimeout` and `setInterval` live in an effect whose cleanup clears them.

**Invalid** (`src/components/blocks/Feed/component.tsx`)

```tsx
const onClick = () => { setTimeout(() => setOpen(false), 300) }
```

**Valid** (`src/components/blocks/Feed/component.tsx`)

```tsx
useEffect(() => {
  const id = setTimeout(() => setOpen(false), 300)
  return () => clearTimeout(id)
}, [])
```

**Finding code:** `FE_EFFECT_CLEANUP`

**Vì sao (why):** `<timer>` ở `<file>` chạy ngoài effect hoặc trong effect không có cleanup gọi `clearTimeout`/`clearInterval`.

**Cách sửa:** Đặt timer trong `useEffect` và trả `() => clearTimeout(id)`; hoặc chuyển vào một hook làm việc đó.

## `starci-fe/no-data-fetch-in-effect`

No `await`, `fetch` or `.then` inside a `useEffect`; read through SWR or a server reader.

**Invalid** (`src/components/blocks/Feed/component.tsx`)

```tsx
useEffect(() => { fetch(url).then(setData) }, [url])
```

**Valid** (`src/components/blocks/Feed/component.tsx`)

```tsx
const { data } = useSWR(key, fetcher)
```

**Finding code:** `FE_EFFECT_FETCH`

**Vì sao (why):** `useEffect` ở `<file>` tải dữ liệu (`await`, `fetch`, `.then`): không cache, không gộp request, không trạng thái loading/lỗi, không huỷ.

**Cách sửa:** Đọc phía client bằng SWR gọi client của app (`hooks/`), phía route bằng server reader `modules/api/<domain>/read-*.ts`.

## `starci-fe/no-empty-catch`

A `catch` that does nothing hides the failure; handle it or return a typed outcome.

**Invalid** (`src/components/blocks/Feed/component.tsx`)

```tsx
try { await save() } catch {}
```

**Valid** (`src/components/blocks/Feed/component.tsx`)

```tsx
try { await save() } catch (error) { return { kind: "unavailable", cause: error } }
```

**Finding code:** `FE_SWALLOWED_ERROR`

**Vì sao (why):** `catch` hoặc `.catch` ở `<file>` không làm gì: lỗi biến mất, không thông báo, không dấu vết.

**Cách sửa:** Trả một outcome có kiểu mang nguyên nhân, hiển thị trạng thái lỗi, hoặc ném lại.

## `starci-fe/no-console`

No `console.*` call in product source.

**Invalid** (`src/components/blocks/Feed/component.tsx`)

```tsx
console.error(error)
```

**Valid** (`src/components/blocks/Feed/component.tsx`)

```tsx
return { kind: "unavailable", cause: error }
```

**Finding code:** `FE_CONSOLE_CALL`

**Vì sao (why):** `console.<method>` ở `<file>`: không vào pipeline log nào và lộ chi tiết nội bộ cho người dùng.

**Cách sửa:** Trả outcome có kiểu, hiển thị trạng thái lỗi, hoặc để lỗi tới `error.tsx`.
