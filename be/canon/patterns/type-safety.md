# type safety

## Definition

The type system is the cheapest reviewer this codebase has: it reads every line, never gets tired,
and objects before the code runs. Every rule here is about **not switching it off** — because each
of the ways to do that looks locally reasonable and is invisible afterwards.

`any` is the obvious one. The others are quieter: a double cast that launders a wrong type through
`unknown`, an inline object type that nothing else can reference, an enum that is erased at compile
time and cannot be read back at runtime.

The question that settles a case: **after this line, does the compiler still know what it had?** If
the answer is no, the line has spent a guarantee, and it needs a reason better than convenience.

What holds this law is [`sources/be/type-safety.mjs`](../../../sources/be/type-safety.mjs).

## Rules

**TYPE-1 · No `any`. Narrow from `unknown` instead.**

`any` does not mean "I do not know this type" — it means "stop checking", and the stopping spreads:
every property read off it, every value derived from it, and every call it is passed to are
unchecked too. `unknown` says the same honest thing and forces the narrowing to happen once, in the
open, where a reader can see what was assumed.

**TYPE-2 · No double cast through `unknown`.**

`x as unknown as T` is the compiler telling you the cast is wrong and being overruled twice. It is
worse than `any` in one specific way: it produces a value that CLAIMS to be `T`, so everything
downstream trusts it completely and the failure surfaces far from the line that caused it.

**TYPE-3 · A destructured parameter's type is a named type, not an inline literal.**

`({ userId, courseId }: { userId: string, courseId: string })` cannot be referenced, reused,
extended or imported — so the second caller writes it again, and the two copies drift silently
because nothing connects them. A named type in the module's types folder is the same information
with a handle on it.

**TYPE-4 · An enum is a plain enum, never `const enum`.**

A `const enum` is inlined at compile time and has no runtime object, so it cannot be iterated,
cannot be reverse-mapped, and cannot cross the isolated-modules boundary this repository compiles
under. The cost it saves is a few bytes; the cost it imposes is a family of things that simply do
not work.

**TYPE-5 · A discriminated union beats a bag of booleans.**

Four booleans admit sixteen combinations, of which perhaps three exist. The other thirteen
type-check, and one of them is what a caller passes at four in the morning. A union of the states
that exist cannot express a state that does not.

**TYPE-6 · The sanctioned exits are stated where they apply.**

The spec family and the test tree may use a double cast: building a deliberately wrong value is how
you prove a closed API refuses it. That exit is for tests and nowhere else, and it is written into
the config rather than sprinkled as per-line suppressions.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| `any` | It does not say "unknown type", it says "stop checking" - and the stopping spreads to everything derived from it | `unknown`, narrowed once in the open |
| `x as unknown as T` | The compiler refused the cast and was overruled twice; the result CLAIMS to be `T`, so the failure surfaces far from here | Fix the type, or narrow with a guard that checks |
| An inline object type on a destructured parameter | It cannot be referenced or imported, so the second caller writes it again and the copies drift | A named type in the module's `types/` |
| `const enum` | It has no runtime object: not iterable, not reverse-mappable, and it cannot cross the isolated-modules boundary | A plain `enum` |
| A set of booleans describing one situation | They multiply into combinations nobody has ever seen, and all of them compile | A discriminated union of the states that exist |
| A per-line suppression for a test-only need | The exit stops being visible and starts being a habit | State the exit in the config, scoped to the test globs |

## Examples

### The ordinary case — unknown, narrowed once

```ts
const parsePayload = (raw: unknown): WebhookPayload => {
    if (typeof raw !== "object" || raw === null || !("event" in raw)) {
        throw new WebhookPayloadInvalidException({})
    }
    return raw as WebhookPayload
}
```

```ts
// Wrong: nothing below this line is checked, including the things built out of it.
const parsePayload = (raw: any): WebhookPayload => raw
```

They differ in one thing: whether the assumption is stated anywhere a reader can find it.

### The laundering trap

```ts
// the guard checks the thing the type claims
if (isEnrollment(row)) {
    return row.courseId
}
```

```ts
// Wrong: the compiler said these types do not overlap, and was overruled. Everything downstream
// now trusts `row` completely, and the failure appears wherever it is finally used.
return (row as unknown as EnrollmentEntity).courseId
```

They differ in one thing: whether anything actually checked.

### The inline-type trap

```ts
/** What granting XP needs. */
export interface GrantXpParams {
    userId: string
    amount: number
}

export const grantXp = ({ userId, amount }: GrantXpParams) => { /* ... */ }
```

```ts
// Wrong: the second caller cannot import this shape, so they retype it - and when a third field
// arrives, one of the two copies gets it.
export const grantXp = ({ userId, amount }: { userId: string, amount: number }) => { /* ... */ }
```

They differ in one thing: whether the shape has a handle.

### The state trap

```ts
type GradeState =
    | { kind: "pending" }
    | { kind: "graded"; score: number }
    | { kind: "failed"; reason: string }
```

```ts
// Wrong: `isGraded && isFailed` compiles, and `isGraded` with no score compiles too.
interface GradeState {
    isPending: boolean
    isGraded: boolean
    isFailed: boolean
    score?: number
}
```

They differ in one thing: whether an impossible state can be written down.
