# Typing

This file answers one question: given a backend value, how is its type declared?

Sources: `tsconfig.json` (`strictNullChecks: true`, `noImplicitAny: false`), `eslint.config.mjs`,
`features/api/core/types/execute.ts`, `features/api/core/graphql/mutations/courses/add-to-cart/*`,
`modules/platform/exceptions/errors/abstract.ts`, `errors/ai/ai-quota-exhausted.ts`,
`modules/api/apollo/server/types/graphql-response.ts`,
`modules/api/apollo/server/interceptors/graphql-transform.interceptor.ts`,
`modules/databases/postgresql/primary/enums/locale.ts`, `modules/platform/cqrs/icqrs-handler.ts`.

## BE-TYPING-1 — `interface` for object shapes, `type` for aliases

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Object shape | `export interface ExecuteParams<T> { request: T; locale?: Locale; user?: UserEntity; … }` (1991 `export interface` against 197 `export type`, of which only 12 are object literals) |
| Case 2 | Exception metadata | `export interface AiQuotaExhaustedExceptionMetadata extends AbstractExceptionMetadata { window: string }` |
| Case 3 | Response contract | `export interface IAbstractGraphQLResponse<T = undefined> { success: boolean; message: string; data?: T; error?: string }` |
| Case 4 | Alias | `export type GraphQLSuccessMessage = Record<Locale, string>` — shares its name with the decorator const |

## BE-TYPING-2 — Named parameter types, no inline objects

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Function taking an object | `constructor({ window, originalError }: AiQuotaExhaustedExceptionMetadata)` — destructured from a named interface (lint `no-inline-param-type`, `no-inline-object-type`) |
| Case 2 | Handler input | `process(command: AddToCartCommand)` — the class is the type |
| Case 3 | Return | always declared on public methods: `Promise<CartItemEntity>`, `Record<KpiKey, number>`, `Observable<GraphQLResponse<T>>` |
| Case 4 | Primitive param | positional, annotated: `execute(key: string)`, `getOriginalError(): Error` |

## BE-TYPING-3 — `readonly`

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Injected dependency | `private readonly entityManager: EntityManager` (2489 against 26 without `readonly`) |
| Case 2 | Message payload | `constructor(readonly params: ExecuteParams<AddToCartRequest>) {}` |
| Case 3 | Exception fields | `readonly code: string`, `readonly metadata?: Record<string, unknown>`, `readonly httpStatus?: number` |
| Case 4 | Decorated GraphQL field | not `readonly`: `@Field(() => ID, { description: "Course id." }) courseId: string` — class-validator/GraphQL classes are mutable DTOs |

## BE-TYPING-4 — Enums

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Declaration | `export enum Locale { Vi = "vi", En = "en" }` — string-valued, PascalCase members (137 enums; `const enum` 0, lint `no-const-enum`) |
| Case 2 | Home | `modules/databases/postgresql/primary/enums/` (76 files), plus per-module `enums/` folders (`platform/exceptions/enums`, `integrations/cache/enums`, `ai/balancer/enums`) |
| Case 3 | GraphQL exposure | `export const GraphQLTypeLocale = createEnumType(Locale)` + `registerEnumType(GraphQLTypeLocale, { name: "Locale", description: "…", valuesMap: { [Locale.Vi]: { … } } })` |
| Case 4 | Boolean on an entity | `isEnrolled: true` in `where` — `is` prefix |

## BE-TYPING-5 — `unknown`, never `any`

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Unknown payload | `readonly metadata?: Record<string, unknown>` |
| Case 2 | Narrowing an error | `originalError: error instanceof Error ? error : undefined`; `error instanceof Error ? error : new Error(String(error))` |
| Case 3 | Apollo's untyped error | `const original = (error as { originalError?: unknown })?.originalError ?? error; if (original instanceof AbstractException) { … }` |
| Case 4 | Residual | 13 `any` sites in 4463 files; lint `@typescript-eslint/no-explicit-any` is at error |
| Case 5 | Double cast | `as unknown as X` only inside `*.spec.ts` and `src/tests/**` (323 specs); banned elsewhere by `no-restricted-syntax` |

## BE-TYPING-6 — Generics

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Template base | `export abstract class ICQRSHandler<TParams, TResponse = unknown>` — `T` prefix on descriptive names |
| Case 2 | Single | `IAbstractGraphQLResponse<T = undefined>`, `GraphQLTransformInterceptor<T = unknown>` |
| Case 3 | Static factory | `static fromJSON<T extends AbstractException>(this: new (message: string, code: string, metadata?: Record<string, unknown>) => T, json: string): T` |

## BE-TYPING-7 — GraphQL classes

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Input | `@InputType({ description: "…" }) export class AddToCartRequest { @Field(() => ID, { description: "Course id." }) courseId: string }` |
| Case 2 | Output | `@ObjectType({ description: "…" }) export class AddToCartResponse extends AbstractGraphQLResponse implements IAbstractGraphQLResponse<CartItemEntity> { @Field(() => CartItemEntity, { nullable: true, description: "…" }) data: CartItemEntity }` |
| Case 3 | `data` nullability | always `nullable: true` — the interceptor writes `data = null` on failure |
| Case 4 | Entity table | every `@Entity` names its table (lint `require-entity-table-name`, 181/181); no `eager: true` relations |
