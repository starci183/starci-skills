# Validation, BE — DTOs and class-validator at the boundary (STRICT)

Scope: EVERY HTTP and GraphQL input passes through a DTO class carrying `class-validator`
decorators AT the field — a malformed or out-of-range input must die BEFORE it reaches business
logic. Grounded in `src/features/api/core/**/graphql-types/request.ts` and `**/dtos/*.request.ts`
(scanned 2026-07-16). Complements [[api-surface]] (the folder shape) and [[type-safety]] §2 (typed
boundaries).

## 0. The pipe is registered at the app level — do not invent `whitelist`

`ValidationPipe` is enabled globally. Do not add exotic options:

- **core** (`apps/core/src/app.module.ts`): `{ provide: APP_PIPE, useClass: ValidationPipe }` —
  plain, no options.
- **mock** (`apps/mock/src/main.ts`): `new ValidationPipe({ transform: true })`. It is the only
  app that bootstraps its own pipe; `apps/tools` used to be the second and is now a static
  dashboard with no Nest entrypoint.

Nowhere in the repo uses `whitelist` or `forbidNonWhitelisted` — do not introduce them without the
teacher's decision. When an HTTP body needs a `string → number` coercion, attach `@Type(() => Number)`
at the field (§5) rather than leaning on a global `transform`.

## 1. Per field: the schema decorator FIRST, then a WHY comment, then the validators

The order is fixed: `@Field` or `@ApiProperty` (schema) comes first, then one comment line stating
the WHY of the constraint, then `@IsOptional` if applicable, then the format and range validators.
The field name is indented one extra level.

```ts
// real example, review-flashcard/graphql-types/request.ts
@Field(
    () => Int,
    {
        description: "SM-2 grade: 0=Again, 1=Hard, 2=Good, 3=Easy.",
    },
)
// reject out-of-range grades before they reach the SM-2 math
@IsInt()
@Min(0)
@Max(3)
    grade: number
```

```ts
// Wrong: hand-written validation in the service instead of at the field
if (typeof grade !== "number") throw ...
```

A REST DTO follows the same shape, with `@ApiProperty` or `@ApiPropertyOptional` as the schema
decorator (`admin/presigned-url/dtos/presigned-url.request.ts`).

## 2. Ranges and lengths are named constants mirroring the database column — no magic numbers

A bound lives in a named constant whose JSDoc says which column it mirrors. Do not scatter bare
numbers through decorators.

```ts
// real example, submit-job-posting/graphql-types/request.ts
/** Upper bound on title length, mirroring the `job_postings.title` column. */
const MAX_TITLE_LENGTH = 255
...
@IsString()
@MaxLength(MAX_TITLE_LENGTH)
    title: string
```

```ts
// Wrong: a bare 255 — when the column changes, nobody remembers to follow
@MaxLength(255) title: string
```

## 3. Optional means `@IsOptional()` and STILL validating the FORMAT when present

An optional field is typed `?`, declared `@Field({ nullable: true })`, and marked `@IsOptional()` —
but IF a value arrives it must still pass its format validator (URL, email, and so on). "Optional"
means it may be absent, not that it may be wrong.

```ts
// real example, submit-job-posting/graphql-types/request.ts
// optional; validated as a URL when present
@IsOptional()
@IsUrl()
@MaxLength(MAX_COMPANY_URL_LENGTH)
    logoUrl?: string

// real example, review-flashcard — an optional uuid
@IsOptional()
@IsUUID()
    sessionId?: string | null
```

## 4. An enum input is `@IsEnum(<TsEnum>)`; the GraphQL type is a separate concern

A discriminator or state passed in is validated with `@IsEnum` against the real TypeScript enum, not
as a free string. The `() => GraphQLType…` thunk is only the schema face.

```ts
// real example, submit-job-posting/graphql-types/request.ts
@Field(() => GraphQLTypeJobApplyMethod, { description: "…" })
// required — every posting needs a way to apply
@IsEnum(JobApplyMethod)
    applyMethod: JobApplyMethod
```

## 5. Nested objects and arrays use `@ValidateNested` with `@Type`, and carry a size ceiling

A child object takes `@ValidateNested()` plus `@Type(() => Child)`. An array takes `@IsArray()`,
`@ArrayMaxSize(<const>)`, `@ValidateNested({ each: true })`, and `@Type(() => Child)`, so each
element validates itself — and it ALWAYS has a size ceiling mirroring the service's own limit.

```ts
// real example, complete-flashcard-quiz-session/graphql-types/request.ts
// bounded per-card breakdown; each element is itself validated (ValidateNested + Type)
@IsArray()
@ArrayMaxSize(MAX_ANSWERS)
@ValidateNested({
    each: true,
})
@Type(() => QuizSessionAnswerRequest)
    answers: Array<QuizSessionAnswerRequest>
```

Coercing a primitive in an HTTP body — where a query or form sends strings — is `@Type(() => Number)`
before `@IsInt()` (real example: `payos/create-payment-link/dtos/request.ts`).

## 6. A cross-field invariant is not class-validator's job — enforce it in the handler with AbstractException

A field decorator cannot see its siblings. A constraint such as "exactly one of two" or "A is
required when B equals x" validates its FORMAT in the DTO, while the cross-field requiredness is
enforced in the handler with an `AbstractException` (see [[exceptions]]).

```ts
// real example, submit-job-posting/graphql-types/request.ts
// field-level check only validates FORMAT when present; the "required
// when applyMethod is ExternalUrl" invariant is cross-field and enforced
// in the handler
@IsOptional()
@IsUrl()
    applyUrl?: string
// the handler throws JobPostingInvalidRequestException when the companyId/newCompany pair is violated
```

Trying to cram a cross-field constraint into one field decorator is the shape to avoid.

## 7. Never trust a client-sent aggregate — re-derive it server-side

A score or total computed by the client is not accepted. The DTO carries only the per-item
breakdown, and the server recomputes.

```ts
// real example, complete-flashcard-quiz-session/graphql-types/request.ts, in its JSDoc
// "The server re-derives the session's aggregate coverage from this
//  per-card breakdown — it never trusts a client-sent aggregate score."
```

## 8. An external webhook is untrusted: an all-optional DTO, with the handler verifying the signature

A webhook payload (PayOS, SePay, NOWPayments) marks EVERY field `@IsOptional()`, because the
provider's URL-confirmation probe sends the fields empty and the pipe must not reject it early.
Authenticity is decided by the handler checking the `signature` and `code`.

```ts
// real example, payos/webhook/dtos/request.ts, in its JSDoc
// "All fields are optional so the global ValidationPipe never rejects a payload
//  before the handler runs … the handler verifies the signature + code
//  authoritatively anyway (mirrors the SePay / NOWPayments webhook DTOs)."
@IsString()
@IsOptional()
    code?: string
```

This is a DELIBERATE exception for the webhook boundary. User-submitted input — a form or a
mutation — is still validated strictly per §1–§6, and must never be made "all optional" to dodge an
error.
