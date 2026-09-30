# Runtime hygiene

Law module: `hygiene.mjs`. Catalogue: R65 FE_SIZE_AND_STATE_BUDGET (sub-checks `FE_EFFECT_CLEANUP`, `FE_SWALLOWED_ERROR`, `FE_CONSOLE_CALL`) and R50 FE_TRANSPORT_OWNER (sub-check `FE_EFFECT_FETCH`).

Work started by a component that nobody owns the end of: a timer, listener, observer, socket or subscription that outlives the component, a fetch in an effect with no cache or cancel, an empty `catch` that hides the failure, a `console` call no pipeline reads. Every rule here decides by resolution: an effect is a call to React's own `useEffect` / `useLayoutEffect` export (the import is followed), the timer or listener is the platform's when its symbol is declared by the default library, "the same handle" is the same scope binding (or member path such as `timerRef.current`), and "a promise" is what the type checker says. There is no folder exemption: a `modules/` file is judged by its structure like any other (the API client starts its timeout timer and clears it in `finally`, in the same function).

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/effect-subscription-needs-cleanup`

Inside a `useEffect` / `useLayoutEffect` callback and inside the subscribe function of `useSyncExternalStore`, everything that keeps running after the callback returns is released by the cleanup the callback returns, against the same handle, target and listener:

| Started | Released by the returned cleanup |
| --- | --- |
| `setTimeout` / `setInterval` (the handle) | `clearTimeout(id)` / `clearInterval(id)` on the same handle (variable, ref member, module `let`, or a list drained with `forEach(clearTimeout)`) |
| `requestAnimationFrame` (the id) | `cancelAnimationFrame(id)` |
| `target.addEventListener(type, listener)` | `target.removeEventListener(type, listener)` with the same target, type and listener binding; an inline listener cannot be removed; or `{ signal }` with `controller.abort()` |
| `new ResizeObserver` / `IntersectionObserver` / `MutationObserver` that is `.observe`d | `observer.disconnect()` |
| `new WebSocket` / `EventSource` / `BroadcastChannel` | `connection.close()` |
| a call returning a subscription object (its type has `unsubscribe`, `off` or `close`) | that method on the stored object |

The cleanup may be a returned function, a named function that is returned, or may call a same-file function that releases. Outside an effect, a timer or frame is accepted only when the function that starts it also releases it (the API client's `try { ... } finally { clearTimeout(id) }`, the `subscribe` that returns its own unsubscribe); a listener started outside an effect is not judged. A function-returning unsubscribe (`const off = on(handler)`) is not decided here: the checker cannot tell it from any other callback.

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

**Valid** also: a function that starts the timer and directly returns a cleanup clearing the same handle (the `subscribe` of `useSyncExternalStore`)

```tsx
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  if (timer === undefined) timer = setInterval(tick, 60_000)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) { clearInterval(timer); timer = undefined }
  }
}
```

**Finding code:** `FE_EFFECT_CLEANUP`

**Vì sao (why):** `<timer>` ở `<file>` chạy ngoài effect hoặc trong effect không có cleanup gọi `clearTimeout`/`clearInterval`.

**Cách sửa:** Đặt timer trong `useEffect` và trả `() => clearTimeout(id)`; hoặc chuyển vào một hook làm việc đó.

## `starci-fe/no-data-fetch-in-effect`

An effect body starts no promise: no `await`, `fetch`, `.then`, `void load()`, `mutate()` or `refresh()`; read through SWR or a server reader. The call is judged when it runs synchronously in the body (an immediately-invoked function counts); a promise started inside a listener or timer callback the effect registers, or in the cleanup, is that callback's work. A call is a load when its type is a promise, when it is `.then`-ed, or when it is `void`-ed and untyped; a platform promise other than `fetch` (`audio.play()`, `clipboard.writeText()`) is not a data load. Data freshness comes from the SWR key: an SWR `mutate()` or `refresh()` called directly in the effect body is a finding too; run it from the event that changed the data (a handler, a socket message).

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
