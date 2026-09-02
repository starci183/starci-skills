# Comment

This file answers one question: given a backend declaration or statement, does it carry a
comment, where does it sit, and what does it say?

Sources: `features/api/core/graphql/mutations/courses/add-to-cart/*`,
`features/api/core/graphql/queries/courses/course/course.handler.ts`,
`modules/platform/exceptions/errors/abstract.ts`, `errors/courses/challenge-not-found.ts`,
`modules/platform/exceptions/filters/abstract-exception-http.filter.ts`,
`modules/databases/postgresql/primary/enums/locale.ts`,
`modules/api/apollo/server/monolithic/monolithic-apollo-server.module.ts`, `eslint.config.mjs`.

## BE-COMMENT-1 — Every export has a docblock, placed after the decorators

1676 of 2009 non-spec files under `features/api/core/graphql` contain a docblock; lint
`require-export-jsdoc` is at error. The block sits between the class decorators and `export class`.

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Resolver | `@Resolver()\n/**\n * GraphQL entry for adding a course to the current user's shopping cart.\n */\nexport class AddToCartResolver` |
| Case 2 | Handler | `@CommandHandler(AddToCartCommand)\n@Injectable()\n/**\n * Handler for the addToCart mutation.\n *\n * Idempotently places a \`(user, course)\` row into the cart: …\n */\nexport class AddToCartHandler` |
| Case 3 | Module | `@Module({ … })\n/** Isolated Nest registration for staging a course in the cart before checkout. */\nexport class AddToCartSingleMutationModule` |
| Case 4 | Input type | `@InputType({ description: "…" })\n/** Request for the addToCart mutation -- identifies the course to add to the caller's cart. */\nexport class AddToCartRequest` |
| Case 5 | Undecorated export | directly above: `/** CQRS command carrying the request/user context for the addToCart mutation. */\nexport class AddToCartCommand` |
| Case 6 | Interceptor | `@Injectable()\n/**\n * Interceptor that wraps resolver result in { data, message, success } and handles errors.\n *\n * @example\n * Use @GraphQLSuccessMessage("Done") on a resolver; …\n */` |

## BE-COMMENT-2 — The docblock states responsibility and invariant, not the name

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Why a field is nullable | `\`data\` … is marked \`nullable: true\` because the transform interceptor sets \`data = null\` on the error path -- a non-nullable field would crash GraphQL and mask the real error instead of surfacing it.` (`AddToCartResponse`) |
| Case 2 | Why a class exists | `Nest's default filter only maps subclasses of \`HttpException\` to their status code -- \`AbstractException\` extends plain \`Error\`, so without this filter every thrown \`AbstractException\` falls through to a generic 500.` (`AbstractExceptionHttpFilter`) |
| Case 3 | What must not happen | `Fails the request when the challenge id is unknown -- downstream must not grade a ghost challenge.` (`ChallengeNotFoundException`) |
| Case 4 | Who throws it | `Thrown by \`AiEntitlementService.consume\` when the user has no remaining allowance in one of the sliding windows, …` |
| Case 5 | Restated name | `/** Constructor. */` still appears in 27 files (`add-to-cart.handler.ts` among them); lint `no-restated-name-jsdoc` names it as debt, not as the pattern |

## BE-COMMENT-3 — Methods and fields

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Method | `/**\n * Processes the addToCart command.\n * @param command - The command carrying request + authenticated user.\n * @returns The cart row holding the course (created or already present).\n */` |
| Case 2 | Field | `/** Unique error code for identification */ readonly code: string`; `/** Id of the course the user wants to place in their cart. */ courseId: string` |
| Case 3 | Interface field with a cross-reference | `/** Enrollment id for the active course (user x course), injected by {@link GraphQLEnrollmentGuard} from the \`x-course-id\` header. … */ enrollmentId?: string` |
| Case 4 | Generic | `@template TParams - The parameters type.` (`ICQRSHandler`) |

## BE-COMMENT-4 — Enum members are each documented

| Case | When | Write |
| --- | --- | --- |
| Case 1 | `Locale` | `/** Serve Vietnamese copy; missing Vi falls through to \`fallbackLocale\`. */ Vi = "vi", /** Serve English copy; also the usual \`defaultLocale\` / fallback. */ En = "en"` (lint `require-enum-member-jsdoc`) |

## BE-COMMENT-5 — Line comments are prose about why

9720 `//` lines exist in non-spec `src/`. They sit above the statement, in lowercase sentence
form, and give the consequence that motivates the code.

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A guard | `// reject unauthenticated callers up front -- cart rows are per-user` |
| Case 2 | A constraint | `// idempotent add: if the (user, course) row already exists, return it as-is --\n// creating a second one would violate UQ_cart_items_user_course` |
| Case 3 | A scope decision | `// a course the user already OWNS must not be carted -- real enrollment (paid)\n// only, so a trial/preview row (is_enrolled = false) still allows adding to cart` |
| Case 4 | A hand-off | `// hand off to the command handler which performs the DB work` |
| Case 5 | Error policy | `// any OTHER error (graphql-js's own execution errors …) is by definition an UNEXPECTED server bug, never the client's fault -- default it to 500 too` |
| Case 6 | The ` -- ` join | used in 1299 of the 9720 lines; a plain sentence is the majority form |

## BE-COMMENT-6 — Block comments for multi-paragraph reasoning inside a body

| Case | When | Write |
| --- | --- | --- |
| Case 1 | `course.handler.ts` | `/*\n * EITHER IDENTIFIER ADDRESSES THE SAME OBJECT, because the synchronizer writes both.\n * \`MaterializeAndUploadService\` uploads … It used to refuse anything but a display id, … That reading was wrong about the bucket …\n */` — opens with a capitalised claim, then the evidence, then the corrected history |
| Case 2 | Config | the `eslint.config.mjs` blocks that record why a rule is at error, with the measured debt (`nợ=0 (296/296)`) |

## BE-COMMENT-7 — What a comment never contains

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Non-ASCII | lint `no-non-ascii-source`, `no-ai-symbol`, `no-emoji`; comments stay ASCII |
| Case 2 | Vietnamese | lint `no-vietnamese`; a Vietnamese string emitted to clients carries a reason: `[Locale.Vi]: "Thêm khóa học vào giỏ hàng thành công", // vn-ok: vi-locale string emitted to clients` (lint `require-vn-ok-reason`) |
| Case 3 | A suppression | `eslint-disable-next-line` (lint `no-line-suppression`); exceptions live in config with a comment |
| Case 4 | A restated name | see BE-COMMENT-2 Case 5 |
