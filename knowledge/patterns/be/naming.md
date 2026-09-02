# Naming

This file answers one question: given a backend file, class, type, constant or method, what is it
called?

Sources: `features/api/core/graphql/mutations/courses/add-to-cart/*`,
`features/api/core/graphql/queries/courses/course/*`, `modules/platform/exceptions/errors/**`,
`modules/databases/postgresql/primary/enums/locale.ts`, `modules/ai/ai-entitlement.service.ts`,
`modules/ai/constants/`, `modules/api/apollo/server/interceptors/graphql-transform.interceptor.ts`.

## BE-NAMING-1 — Files: kebab-case plus a role suffix

| Case | When | Write |
| --- | --- | --- |
| Case 1 | GraphQL unit | `add-to-cart.handler.ts`, `add-to-cart.service.ts`, `add-to-cart.resolver.ts`, `add-to-cart.command.ts`, `course.query.ts`, `add-to-cart.module.ts`, `add-to-cart.module-definition.ts` |
| Case 2 | Capability | `winston.service.ts`, `winston.providers.ts`, `winston.decorators.ts`, `keycloak-auth-graphql.guard.ts`, `graphql-transform.interceptor.ts`, `abstract-exception-http.filter.ts` |
| Case 3 | Data | `cart-item.entity.ts`, `enums/locale.ts`, `kpi-current.util.ts` |
| Case 4 | Exception | `errors/courses/challenge-not-found.ts` — no suffix (289 of 294) |
| Case 5 | Spec | same basename plus `.spec` / `.int-spec`: `add-to-cart.handler.spec.ts`, `schema-builds.int-spec.ts` |
| Case 6 | Migration | `1719200000000-AddIsEnrolledToEnrollments.ts` |

## BE-NAMING-2 — Classes: PascalCase subject plus role

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Handler / Service / Resolver | `AddToCartHandler`, `AddToCartService`, `AddToCartResolver`, `CourseHandler` (154 `…Handler`, 701 `…Service`, 309 `…Resolver`) |
| Case 2 | Message | `AddToCartCommand` (83), `CourseQuery` (67) |
| Case 3 | GraphQL types | `AddToCartRequest` (209 `…Request`), `AddToCartResponse` (303 `…Response`) |
| Case 4 | Unit module | `AddToCartSingleMutationModule extends ConfigurableModuleClass`; query units `…SingleQueryModule` |
| Case 5 | Capability module | `AiModule`, `AiBalancerModule`, `WinstonModule` (552 `…Module`) |
| Case 6 | Entity | `CartItemEntity`, `CourseEntity`, `EnrollmentEntity`, `UserEntity` (200) |
| Case 7 | Others | `KeycloakAuthGraphQLGuard`, `GraphQLTransformInterceptor`, `AbstractExceptionHttpFilter`, `ICQRSHandler` (abstract base, `I` prefix kept) |

## BE-NAMING-3 — Exception identity

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Class | `ChallengeNotFoundException`, `AiQuotaExhaustedException` — ends in `Exception` (337; lint `exception-name-ends-in-exception`) |
| Case 2 | Code | `"CHALLENGE_NOT_FOUND_EXCEPTION"`, `"AI_QUOTA_EXHAUSTED_EXCEPTION"` — the class name in UPPER_SNAKE (lint `exception-code-matches-class-name`) |
| Case 3 | Metadata | `interface ChallengeNotFoundExceptionMetadata extends AbstractExceptionMetadata` (285 of 294 files; lint `exception-metadata-type-named-for-class`) |
| Case 4 | Message | a short sentence: `"Challenge not found"`, `` `AI quota exhausted (${window})` `` |

## BE-NAMING-4 — Enums

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Declaration | `export enum Locale { Vi = "vi", En = "en" }`, `export enum ActionType { … }` — PascalCase name and members, string values (137 enums, 0 `const enum`) |
| Case 2 | GraphQL registration | `export const GraphQLTypeLocale = createEnumType(Locale)` then `registerEnumType(GraphQLTypeLocale, { name: "Locale", … })` |
| Case 3 | Log identity | `WinstonLog.HttpExceptionLogged` — an enum member, never a string message |
| Case 4 | Throttle level | `ThrottlerConfig.Medium` |

## BE-NAMING-5 — Constants

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Module-level value | `const SUCCESS_MESSAGE_METADATA = "graphqlSuccessMessage"`, `TIER_ALLOWED_CATEGORIES`, `const POSTGRESQL_PRIMARY = "primary"` (194 exported UPPER_SNAKE consts) |
| Case 2 | Constants file | `modules/ai/constants/ai-entitlement.constants.ts`, `constants/credit-cost.ts` |
| Case 3 | Exported function value | camelCase arrow: `export const getKpiCurrentValues = (stats: UserStatsResult): Record<KpiKey, number> => …`, `export const GraphQLSuccessMessage = (message) => SetMetadata(…)` (decorator factories keep PascalCase) |
| Case 4 | Spec fixtures | `const BASE_CREDITS_5H = 30`, `const futureDate = (): Date => …` |

## BE-NAMING-6 — Methods

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Handler body | `protected override async process(command: AddToCartCommand)` — always `process` (140/140) |
| Case 2 | Service and resolver door | `async execute(params: ExecuteParams<AddToCartRequest>)` |
| Case 3 | Capability service | verbs: `resolve`, `consume`, `history`, `snapshot`, `assertNotOverQuota`, `getSettings`, `grantTier` (`AiEntitlementService`) |
| Case 4 | Not a bare verb export | lint `no-bare-verb-export`; `getKpiCurrentValues`, not `get` |
| Case 5 | No version in a name | lint `no-version-in-name` |

## BE-NAMING-7 — Type names

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Input object | `…Params` (614 interfaces): `ExecuteParams<T>`, `UseQueryCourseSwrParams` |
| Case 2 | Output object | `…Result` (216): `UserStatsResult` |
| Case 3 | Options | `…Options` (35) |
| Case 4 | Exception payload | `…ExceptionMetadata` (290) |
| Case 5 | Plain interface for a decorated class | `IAbstractGraphQLResponse<T>` beside `AbstractGraphQLResponse` |

## BE-NAMING-8 — GraphQL surface

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Field name | camelCase in the decorator: `@Mutation(() => AddToCartResponse, { name: "addToCart", … })` |
| Case 2 | Argument | always `"request"`: `@Args("request", { description: "Course id to add to the cart." }) request: AddToCartRequest` |
| Case 3 | Own decorators | `@InjectPrimaryPostgreSQLEntityManager()`, `@KeycloakGraphQLUser()`, `@GraphQLLocale()`, `@UseThrottler(…)`, `@GraphQLSuccessMessage({…})` |
