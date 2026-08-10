# Type safety, BE — STRICT (NestJS / TypeScript)

Source: `tsconfig.json` (`strictNullChecks: true`, `noImplicitAny: false`), `eslint.config.mjs`
(`no-explicit-any: off`), and a scan of the real `src/` on 2026-07-16. The machine does NOT block
`any` or `as` — but the codebase is very nearly clean of both, and keeping it clean is a RULE, not a
suggestion.

## 1. No `any` — use `unknown` and narrow

Production `src/` is almost free of `any`. What remains is `argsExtractor`
(`src/modules/integrations/cache/types/graphql-cache.ts`, `(request: any, user: any) => Array<any>`) and an
`any[]` inside a raw-SQL tuple in `process-video`
(`src/modules/integrations/bullmq/types/payloads/process-video.ts`). That is old debt; do not add new sites.

Input of unknown type — a caught error, an external payload — is `unknown`, then narrowed with
`typeof`, `instanceof`, or duck typing:

```ts
// src/modules/ai/ping/utils/to-error-message.ts
export const toPingErrorMessage = (err: unknown): string => {
    const base = err instanceof Error ? err.message : String(err)
    ...
}
const extractResponseDetail = (err: unknown): string | null => {
    if (typeof err !== "object" || err === null) {
        return null
    }
    const data = (err as { response?: { data?: unknown } }).response?.data
    ...
}
```

```ts
// Wrong: swallows every downstream type check
const handle = (err: any) => err.response.data.error.message
```

Narrow step by step, as above: cast to the MINIMAL shape with a `?: unknown` field, check `typeof`
before use, and never cast straight to a full shape.

## 2. The boundary is a DTO plus class-validator — never trust input

Every HTTP and GraphQL input passes through a DTO class with validation decorators AT the field, so
an out-of-range value dies BEFORE it reaches business logic (see also [[api-surface]]):

```ts
// review-flashcard/graphql-types/request.ts
// reject out-of-range grades before they reach the SM-2 math
@IsInt()
@Min(0)
@Max(3)
    grade: number
```

```ts
// Wrong: hand-written validation in the service — or worse, none at all
if (typeof grade !== "number") throw ...
```

The outbound direction is typed too: a resolver returns `Promise<<Op>Data>` (an `@ObjectType`
class), and REST returns a response DTO with `@ApiProperty`. A queue payload is also a boundary —
see §6 on `satisfies`.

## 3. Enums for state and kind — every member carries JSDoc

State and kind are never string literals scattered around; they are an `enum` living in the module's
`enums/` folder, with PascalCase members, string values, and a one-line JSDoc per member stating its
CONSEQUENCE:

```ts
// src/modules/ai/balancer/enums/ai-error-kind.ts
export enum AiErrorKind {
    /** Invalid / revoked / unauthorized key (401/403) → hard-disable the key. */
    Auth = "auth",
    /** Rate limit / quota (429) → short cooldown, key auto-recovers. */
    RateLimit = "rateLimit",
    ...
}
```

```ts
// Wrong: a magic string, and no exhaustiveness check possible
if (error.kind === "rate_limit") ...
```

A local discriminant not worth a whole enum is a literal with `as const`, to keep it narrow:
`axis: "phase" as const` (real example:
`user-mock-interview-course-stats-projection.service.ts`).

## 4. A service's return type is EXPLICIT, and the type lives in `types/`

A public service method ALWAYS declares `Promise<XResult>` explicitly, and the params and result
interfaces live in the module's `types/` folder behind a barrel — never inline in the service, and
never left to inference:

```ts
// flashcard-review.service.ts
async listDue(
    { userId, courseId, limit, locale }: ListDueFlashcardsParams,
): Promise<DueFlashcardsResult> {
```

```ts
// Wrong: the caller has to guess the shape, and changing the internals breaks it silently
async listDue(params) { return { count, cards } }
```

## 5. `strictNullChecks` is ON — no loose `!`

All of `src/` contains just 13 `!` assertions, most of them where an AWS SDK returns an optional that
the surrounding logic guarantees. The defaults are:

- `??` for a fallback: `exception.httpStatus ?? HttpStatus.INTERNAL_SERVER_ERROR` (from the real
  filter).
- `?.` for an optional path: `(err as {...}).response?.data`.
- `!` ONLY where the invariant is guaranteed by the query or API itself and the type cannot express
  it — with a one-line comment stating that invariant. If you cannot explain it in one line,
  refactor until the type says it for you.

```ts
// Wrong: hides a null bug instead of handling it
const enrollment = await repo.findOne(...)
return enrollment!.id
```

## 6. No loose `as X` — prefer `satisfies` and type guards

**`satisfies`** is for checking a shape without changing the type, and it is the house standard for a
queue payload:

```ts
// send-mail.service.ts — params are checked against the SendMailPayload contract at compile time
payload: this.superJson.stringify(params satisfies SendMailPayload),
```

**A type guard or predicate** replaces a cast after a filter:

```ts
// flashcard-review.service.ts
.filter((card): card is FlashcardCardEntity => Boolean(card))

// init-config-parser.service.ts
private isPlainObject(value: unknown): value is Record<string, unknown> {
```

`as X` is permitted when a library's typing forces it, with a visible reason — a comment, or a
context obvious in one line: `ms((...) as ms.StringValue)` (real example: `parse-env.ts`).

**`as unknown as` is BANNED in production.** It exists today only inside `*.spec.ts` mocks; keep that
boundary. An `as unknown as` outside a spec is wrong code.

Casting the result of a query or an entity needs a reason and a comment; the default is to use the
right `select` and relations so TypeORM returns the right type in the first place.

## 7. Generics for reusable helpers, `as const` for literal tables

```ts
// parse-env.ts — the caller decides T, so nothing becomes any
export const parseEnvJson = <T>({ key, defaultValue }: ParseEnvJsonParams): T => ...

// the framework's own generics type a boundary rather than casting it
const response = ctx.getResponse<Response>()          // express Response
if (host.getType<string>() === "graphql") ...

// points-config.ts and routes.ts — a constant table locked with as const
} as const
```

## 8. Typed config — never read `process.env` in scattered places

`process.env` may be touched ONLY in `src/modules/platform/env/utils/parse-env.ts`. Every consumer reads the
typed tree `envConfig().<domain>.<key>`, where each field has JSDoc and a default (see
`env/config.ts`):

```ts
// sepay.providers.ts
} = envConfig().services.api.sepay
```

```ts
// Wrong: a dead string, no default, no type
const key = process.env.SEPAY_API_KEY
```

Adding new config means adding a field to `envConfig()` through a `parseEnv*` helper — never
`process.env.X` in a service, resolver, or worker. The single exception is a `*.spec.ts` setting env
to test the parse layer itself, as `judge0.service.spec.ts` does.
