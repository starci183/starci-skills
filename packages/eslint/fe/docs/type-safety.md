# Type safety

Law module: `type-safety.mjs`. Catalogue: R22 HFS_TS_STRICT, sub-check `FE_TYPE_ESCAPE`.

The compiler is told the truth or it is not told at all. The double cast, the plain assertion, the non-null assertion and `any` are the four spellings of "trust me". `as const`, `as unknown` and `satisfies` stay allowed. Specs are exempt: a test builds values the types forbid, because that is what it proves.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/no-double-cast`

No cast through `unknown`; it turns checking off at the boundary.

**Invalid** (`src/modules/api/read-course.ts`)

```tsx
const row = payload as unknown as CourseRow
```

**Valid** (`src/modules/api/read-course.ts`)

```tsx
const row = parseCourseRow(payload)
```

**Finding code:** `FE_TYPE_ESCAPE`

**Vì sao (why):** `<file>` ép kiểu qua `unknown` (`as unknown as T`): trình biên dịch quên mọi thứ nó biết ngay tại chỗ dữ liệu đi vào.

**Cách sửa:** Thu hẹp từ `unknown` bằng type guard hoặc parser; không ép kiểu.

## `starci-fe/no-type-assertion`

No `as T` or `<T>x`; narrow with a check, a guard or a parser.

**Invalid** (`src/modules/api/read-course.ts`)

```tsx
const row = payload as CourseRow
```

**Valid** (`src/modules/api/read-course.ts`)

```tsx
const row = isCourseRow(payload) ? payload : null
```

**Finding code:** `FE_TYPE_ESCAPE`

**Vì sao (why):** `<file>` dùng `as T` hoặc `<T>x`: một lời khẳng định trình biên dịch không kiểm được. Sai thì lỗi rơi vào trình duyệt của người dùng.

**Cách sửa:** Thu hẹp bằng type guard, `in`, discriminant hoặc parser tại nơi dữ liệu đi vào; dùng `satisfies` nếu chỉ muốn kiểm một literal.

## `starci-fe/no-non-null-assertion`

No non-null assertion (`x!`); prove the value is there.

**Invalid** (`src/components/blocks/Feed/index.tsx`)

```tsx
const first = rows[0]!
```

**Valid** (`src/components/blocks/Feed/index.tsx`)

```tsx
const first = rows[0] ?? fallbackRow
```

**Finding code:** `FE_TYPE_ESCAPE`

**Vì sao (why):** `<file>` dùng `x!`: khẳng định giá trị có mặt mà không chứng minh.

**Cách sửa:** Xử lý nhánh vắng mặt (`if`, `??`, return sớm) hoặc sửa kiểu để giá trị không thể vắng.

## `starci-fe/no-explicit-any`

No `any`; use a real type or `unknown` and narrow.

**Invalid** (`src/modules/api/read-course.ts`)

```tsx
const parse = (value: any) => value.id
```

**Valid** (`src/modules/api/read-course.ts`)

```tsx
const parse = (value: unknown) => (isCourseRow(value) ? value.id : null)
```

**Finding code:** `FE_TYPE_ESCAPE`

**Vì sao (why):** `<file>` dùng `any`: tắt kiểm kiểu cho giá trị đó và mọi thứ suy ra từ nó.

**Cách sửa:** Dùng kiểu thật, generic, hoặc `unknown` rồi thu hẹp tại chỗ dùng.
