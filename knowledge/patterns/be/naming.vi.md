# Đặt tên

Tệp này trả lời một câu hỏi: cho một tệp, lớp, kiểu, hằng hay phương thức backend, nó được gọi là
gì?

Nguồn: `features/api/core/graphql/mutations/courses/add-to-cart/*`,
`features/api/core/graphql/queries/courses/course/*`, `modules/platform/exceptions/errors/**`,
`modules/databases/postgresql/primary/enums/locale.ts`, `modules/ai/ai-entitlement.service.ts`,
`modules/ai/constants/`, `modules/api/apollo/server/interceptors/graphql-transform.interceptor.ts`.

## BE-NAMING-1 — Tệp: kebab-case cộng hậu tố vai trò

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Đơn vị GraphQL | `add-to-cart.handler.ts`, `add-to-cart.service.ts`, `add-to-cart.resolver.ts`, `add-to-cart.command.ts`, `course.query.ts`, `add-to-cart.module.ts`, `add-to-cart.module-definition.ts` |
| Case 2 | Năng lực | `winston.service.ts`, `winston.providers.ts`, `winston.decorators.ts`, `keycloak-auth-graphql.guard.ts`, `graphql-transform.interceptor.ts`, `abstract-exception-http.filter.ts` |
| Case 3 | Dữ liệu | `cart-item.entity.ts`, `enums/locale.ts`, `kpi-current.util.ts` |
| Case 4 | Exception | `errors/courses/challenge-not-found.ts` — không hậu tố (289 trên 294) |
| Case 5 | Spec | cùng tên gốc cộng `.spec` / `.int-spec`: `add-to-cart.handler.spec.ts`, `schema-builds.int-spec.ts` |
| Case 6 | Migration | `1719200000000-AddIsEnrolledToEnrollments.ts` |

## BE-NAMING-2 — Lớp: chủ thể PascalCase cộng vai trò

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Handler / Service / Resolver | `AddToCartHandler`, `AddToCartService`, `AddToCartResolver`, `CourseHandler` (154 `…Handler`, 701 `…Service`, 309 `…Resolver`) |
| Case 2 | Thông điệp | `AddToCartCommand` (83), `CourseQuery` (67) |
| Case 3 | Kiểu GraphQL | `AddToCartRequest` (209 `…Request`), `AddToCartResponse` (303 `…Response`) |
| Case 4 | Module đơn vị | `AddToCartSingleMutationModule extends ConfigurableModuleClass`; đơn vị query là `…SingleQueryModule` |
| Case 5 | Module năng lực | `AiModule`, `AiBalancerModule`, `WinstonModule` (552 `…Module`) |
| Case 6 | Entity | `CartItemEntity`, `CourseEntity`, `EnrollmentEntity`, `UserEntity` (200) |
| Case 7 | Khác | `KeycloakAuthGraphQLGuard`, `GraphQLTransformInterceptor`, `AbstractExceptionHttpFilter`, `ICQRSHandler` (lớp gốc trừu tượng, giữ tiền tố `I`) |

## BE-NAMING-3 — Danh tính exception

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Lớp | `ChallengeNotFoundException`, `AiQuotaExhaustedException` — kết thúc bằng `Exception` (337; lint `exception-name-ends-in-exception`) |
| Case 2 | Mã | `"CHALLENGE_NOT_FOUND_EXCEPTION"`, `"AI_QUOTA_EXHAUSTED_EXCEPTION"` — tên lớp viết UPPER_SNAKE (lint `exception-code-matches-class-name`) |
| Case 3 | Metadata | `interface ChallengeNotFoundExceptionMetadata extends AbstractExceptionMetadata` (285 trên 294 tệp; lint `exception-metadata-type-named-for-class`) |
| Case 4 | Thông điệp | một câu ngắn: `"Challenge not found"`, `` `AI quota exhausted (${window})` `` |

## BE-NAMING-4 — Enum

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Khai báo | `export enum Locale { Vi = "vi", En = "en" }`, `export enum ActionType { … }` — tên và thành viên PascalCase, giá trị chuỗi (137 enum, 0 `const enum`) |
| Case 2 | Đăng ký GraphQL | `export const GraphQLTypeLocale = createEnumType(Locale)` rồi `registerEnumType(GraphQLTypeLocale, { name: "Locale", … })` |
| Case 3 | Danh tính log | `WinstonLog.HttpExceptionLogged` — một thành viên enum, không bao giờ là chuỗi thông điệp |
| Case 4 | Mức throttle | `ThrottlerConfig.Medium` |

## BE-NAMING-5 — Hằng

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Giá trị cấp module | `const SUCCESS_MESSAGE_METADATA = "graphqlSuccessMessage"`, `TIER_ALLOWED_CATEGORIES`, `const POSTGRESQL_PRIMARY = "primary"` (194 hằng UPPER_SNAKE được export) |
| Case 2 | Tệp hằng | `modules/ai/constants/ai-entitlement.constants.ts`, `constants/credit-cost.ts` |
| Case 3 | Giá trị hàm được export | arrow camelCase: `export const getKpiCurrentValues = (stats: UserStatsResult): Record<KpiKey, number> => …`, `export const GraphQLSuccessMessage = (message) => SetMetadata(…)` (nhà máy decorator giữ PascalCase) |
| Case 4 | Fixture trong spec | `const BASE_CREDITS_5H = 30`, `const futureDate = (): Date => …` |

## BE-NAMING-6 — Phương thức

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Thân handler | `protected override async process(command: AddToCartCommand)` — luôn là `process` (140/140) |
| Case 2 | Cửa của service và resolver | `async execute(params: ExecuteParams<AddToCartRequest>)` |
| Case 3 | Service năng lực | động từ: `resolve`, `consume`, `history`, `snapshot`, `assertNotOverQuota`, `getSettings`, `grantTier` (`AiEntitlementService`) |
| Case 4 | Không export động từ trần | lint `no-bare-verb-export`; `getKpiCurrentValues`, không phải `get` |
| Case 5 | Không phiên bản trong tên | lint `no-version-in-name` |

## BE-NAMING-7 — Tên kiểu

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Object đầu vào | `…Params` (614 interface): `ExecuteParams<T>`, `UseQueryCourseSwrParams` |
| Case 2 | Object đầu ra | `…Result` (216): `UserStatsResult` |
| Case 3 | Tùy chọn | `…Options` (35) |
| Case 4 | Payload exception | `…ExceptionMetadata` (290) |
| Case 5 | Interface thuần cho một lớp có decorator | `IAbstractGraphQLResponse<T>` bên cạnh `AbstractGraphQLResponse` |

## BE-NAMING-8 — Bề mặt GraphQL

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Tên trường | camelCase trong decorator: `@Mutation(() => AddToCartResponse, { name: "addToCart", … })` |
| Case 2 | Đối số | luôn là `"request"`: `@Args("request", { description: "Course id to add to the cart." }) request: AddToCartRequest` |
| Case 3 | Decorator của mình | `@InjectPrimaryPostgreSQLEntityManager()`, `@KeycloakGraphQLUser()`, `@GraphQLLocale()`, `@UseThrottler(…)`, `@GraphQLSuccessMessage({…})` |
