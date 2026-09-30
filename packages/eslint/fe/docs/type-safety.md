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

**Why:** `<file>` casts through `unknown` (`as unknown as T`): the compiler forgets everything it knows exactly where the data enters.

**Fix:** Narrow from `unknown` with a type guard or parser; do not cast.

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

**Why:** `<file>` uses `as T` or `<T>x`: an assertion the compiler cannot check. If wrong, the error lands in the user's browser.

**Fix:** Narrow with a type guard, `in`, a discriminant or a parser where the data enters; use `satisfies` if you only want to check a literal.

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

**Why:** `<file>` uses `x!`: it asserts a value is present without proving it.

**Fix:** Handle the absent branch (`if`, `??`, early return) or fix the type so the value cannot be absent.

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

**Why:** `<file>` uses `any`: it turns off type checking for that value and everything inferred from it.

**Fix:** Use a real type, a generic, or `unknown` and then narrow at the point of use.
