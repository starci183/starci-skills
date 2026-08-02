# API surface — GraphQL resolver, REST controller, and DTO

Source: `src/features/api/core/graphql/mutations/flashcard/review-flashcard/` (the canonical
mutation) and `src/features/api/core/http/admin/presigned-url/` (the canonical REST endpoint).

## GraphQL: one operation, one folder

```
mutations/<domain>/<operation>/          # queries/ has the same shape
├── <operation>.resolver.ts
├── <operation>.module.ts                # providers: [<Op>Resolver]; class <Op>SingleMutationModule
├── <operation>.module-definition.ts     # the ConfigurableModuleBuilder shape (see [[modules-and-di]])
├── graphql-types/
│   ├── request.ts                       # @InputType plus class-validator
│   ├── response.ts                      # a Data @ObjectType plus a Response wrapper
│   └── index.ts
└── index.ts                             # exports the module, the resolver, and graphql-types
```

### The resolver — a decorator stack, COMPLETE and IN ORDER

```ts
// the real ReviewFlashcardResolver
@Resolver()
export class ReviewFlashcardResolver {
    constructor(
        private readonly flashcardReviewService: FlashcardReviewService,
    ) {}

    @UseThrottler(ThrottlerConfig.Soft)
    @UseGuards(KeycloakAuthGraphQLGuard,
        GraphQLEnrollmentGuard)
    @GraphQLSuccessMessage({
        [Locale.En]: "Flashcard reviewed successfully",
        [Locale.Vi]: "Ôn thẻ thành công",
    })
    @UseInterceptors(GraphQLTransformInterceptor)
    @Mutation(
        () => ReviewFlashcardResponse,
        {
            name: "reviewFlashcard",
            description: "Grade a flashcard (SM-2) and schedule its next review.",
        },
    )
    async execute(
        @Args("request")
            request: ReviewFlashcardRequest,
        @KeycloakGraphQLUser()
            user: UserEntity,
    ): Promise<ReviewFlashcardData> {
        return this.flashcardReviewService.review({
            userId: user.id,
            cardId: request.cardId,
            grade: request.grade,
        })
    }
}
```

The rules:

- The method is named **`execute`** and returns `Promise<…Data>`; the interceptor adds the wrapper.
- **The resolver is THIN**: it maps the request onto a single service call from `@modules/bussiness`.
  Business logic never lives in a resolver.
- A user-facing mutation carries `@GraphQLSuccessMessage` in both `Locale.En` and `Locale.Vi`, plus
  `GraphQLTransformInterceptor`.
- Auth is `KeycloakAuthGraphQLGuard` with the user injected via `@KeycloakGraphQLUser()`; a
  course-scoped operation adds `GraphQLEnrollmentGuard`.
- A mutation that writes data carries a rate limit: `@UseThrottler(ThrottlerConfig.*)`.
- `@Mutation` always has both `name` and `description`.

### graphql-types

- `request.ts` uses `@InputType({ description })`, gives every `@Field` a `description`, and
  validates AT the field with class-validator (`@IsInt() @Min(0) @Max(3)`,
  `@IsOptional() @IsUUID()`). An optional field is `nullable: true` and `?:`.
- `response.ts` holds two classes: `<Op>Data` (an `@ObjectType`, the real payload) and
  `<Op>Response extends AbstractGraphQLResponse implements IAbstractGraphQLResponse<<Op>Data>` from
  `@modules/api`, with `data` nullable. Do not invent your own wrapper.
- **For an enum, the thunk uses the `GraphQLType*` wrapper while the TypeScript type is the native
  enum** — they are two different things:
  `@Field(() => GraphQLTypePaymentType) paymentType: PaymentType` (real example:
  `courses-checkout/graphql-types/request.ts`). Passing the native enum as the thunk —
  `@Field(() => PaymentType)` — produces a wrong schema.
- An id is `@Field(() => ID)` while the TypeScript type is `string`; a list is `() => [ID]` with
  `Array<string>`.

## REST controllers (rarer — admin, oauth, webhooks)

Following `PresignedUrlController`:

- Paths and tags are never hard-coded strings: `@ApiTags(httpConfig().admin().tags)`,
  `@Controller({ path: httpConfig().admin().tags, version: "1" })`, and
  `@Post(httpConfig().admin().presignedUrl().path)`. Every path is declared in `httpConfig()`, and a
  controller ALWAYS carries `version: "1"`.
- The success message is `@RestSuccessMessage("...")` — a single string, not the bilingual object
  GraphQL uses — together with `@UseInterceptors(RestTransformInterceptor)`.
- Swagger is complete: `@ApiOperation({ summary, description })` and
  `@ApiResponse({ status, description, type })`.
- DTOs live in `dtos/` behind a barrel index. A request DTO uses `@ApiProperty` and
  `@ApiPropertyOptional` (each with a `description` and an `example`) plus class-validator, which is
  REQUIRED — it is REST's only validation gate: `@Type(() => Number) @IsInt() @Min(1)`,
  `@IsUrl(...)`, `@IsOptional() @IsString()`. A response is
  `<Op>Response extends AbstractRestResponse<<Op>Data>` with `declare data: <Op>Data` (real example:
  `payos/create-payment-link/dtos/response.ts`).
- A controller is as THIN as a resolver: one service call, no business logic.

## Banned at the API surface

- A `@Field` or `@InputType` without a `description` — the schema is living documentation; do not
  leave it blank.
- Hand-written validation inside a resolver or service instead of decorators on the DTO. An
  out-of-range value must die BEFORE it reaches the business maths — see the comment on `grade` in
  the real request type.
- Returning a framework built-in exception from a guard or resolver — see [[exceptions]]; guard
  exceptions carry their own `httpStatus`.
- A backwards import: `@modules/bussiness` must never import from `features/api`. The dependency
  direction is api → bussiness → infrastructure.
