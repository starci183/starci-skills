# Kiểu

Tệp này trả lời một câu hỏi: cho một giá trị backend, kiểu của nó được khai báo thế nào?

Nguồn: `tsconfig.json` (`strictNullChecks: true`, `noImplicitAny: false`), `eslint.config.mjs`,
`features/api/core/types/execute.ts`, `features/api/core/graphql/mutations/courses/add-to-cart/*`,
`modules/platform/exceptions/errors/abstract.ts`, `errors/ai/ai-quota-exhausted.ts`,
`modules/api/apollo/server/types/graphql-response.ts`,
`modules/api/apollo/server/interceptors/graphql-transform.interceptor.ts`,
`modules/databases/postgresql/primary/enums/locale.ts`, `modules/platform/cqrs/icqrs-handler.ts`.

## BE-TYPING-1 — `interface` cho hình dạng object, `type` cho bí danh

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Hình dạng object | `export interface ExecuteParams<T> { request: T; locale?: Locale; user?: UserEntity; … }` (1991 `export interface` so với 197 `export type`, trong đó chỉ 12 là object literal) |
| Case 2 | Metadata exception | `export interface AiQuotaExhaustedExceptionMetadata extends AbstractExceptionMetadata { window: string }` |
| Case 3 | Hợp đồng response | `export interface IAbstractGraphQLResponse<T = undefined> { success: boolean; message: string; data?: T; error?: string }` |
| Case 4 | Bí danh | `export type GraphQLSuccessMessage = Record<Locale, string>` — trùng tên với const decorator |

## BE-TYPING-2 — Kiểu tham số có tên, không object nội tuyến

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Hàm nhận object | `constructor({ window, originalError }: AiQuotaExhaustedExceptionMetadata)` — phá cấu trúc từ một interface có tên (lint `no-inline-param-type`, `no-inline-object-type`) |
| Case 2 | Đầu vào handler | `process(command: AddToCartCommand)` — lớp chính là kiểu |
| Case 3 | Trả về | luôn khai báo trên phương thức công khai: `Promise<CartItemEntity>`, `Record<KpiKey, number>`, `Observable<GraphQLResponse<T>>` |
| Case 4 | Tham số nguyên thủy | theo vị trí, có chú kiểu: `execute(key: string)`, `getOriginalError(): Error` |

## BE-TYPING-3 — `readonly`

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Phụ thuộc được tiêm | `private readonly entityManager: EntityManager` (2489 so với 26 không `readonly`) |
| Case 2 | Payload thông điệp | `constructor(readonly params: ExecuteParams<AddToCartRequest>) {}` |
| Case 3 | Trường exception | `readonly code: string`, `readonly metadata?: Record<string, unknown>`, `readonly httpStatus?: number` |
| Case 4 | Trường GraphQL có decorator | không `readonly`: `@Field(() => ID, { description: "Course id." }) courseId: string` — lớp class-validator/GraphQL là DTO khả biến |

## BE-TYPING-4 — Enum

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Khai báo | `export enum Locale { Vi = "vi", En = "en" }` — giá trị chuỗi, thành viên PascalCase (137 enum; `const enum` 0, lint `no-const-enum`) |
| Case 2 | Nhà | `modules/databases/postgresql/primary/enums/` (76 tệp), cộng thư mục `enums/` theo module (`platform/exceptions/enums`, `integrations/cache/enums`, `ai/balancer/enums`) |
| Case 3 | Phơi ra GraphQL | `export const GraphQLTypeLocale = createEnumType(Locale)` + `registerEnumType(GraphQLTypeLocale, { name: "Locale", description: "…", valuesMap: { [Locale.Vi]: { … } } })` |
| Case 4 | Boolean trên entity | `isEnrolled: true` trong `where` — tiền tố `is` |

## BE-TYPING-5 — `unknown`, không bao giờ `any`

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Payload chưa biết | `readonly metadata?: Record<string, unknown>` |
| Case 2 | Thu hẹp một lỗi | `originalError: error instanceof Error ? error : undefined`; `error instanceof Error ? error : new Error(String(error))` |
| Case 3 | Lỗi không kiểu của Apollo | `const original = (error as { originalError?: unknown })?.originalError ?? error; if (original instanceof AbstractException) { … }` |
| Case 4 | Còn sót | 13 chỗ `any` trong 4463 tệp; lint `@typescript-eslint/no-explicit-any` ở mức error |
| Case 5 | Ép kép | `as unknown as X` chỉ bên trong `*.spec.ts` và `src/tests/**` (323 spec); bị cấm nơi khác bởi `no-restricted-syntax` |

## BE-TYPING-6 — Generic

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Lớp gốc khuôn | `export abstract class ICQRSHandler<TParams, TResponse = unknown>` — tiền tố `T` trên tên mô tả |
| Case 2 | Đơn | `IAbstractGraphQLResponse<T = undefined>`, `GraphQLTransformInterceptor<T = unknown>` |
| Case 3 | Nhà máy tĩnh | `static fromJSON<T extends AbstractException>(this: new (message: string, code: string, metadata?: Record<string, unknown>) => T, json: string): T` |

## BE-TYPING-7 — Lớp GraphQL

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Đầu vào | `@InputType({ description: "…" }) export class AddToCartRequest { @Field(() => ID, { description: "Course id." }) courseId: string }` |
| Case 2 | Đầu ra | `@ObjectType({ description: "…" }) export class AddToCartResponse extends AbstractGraphQLResponse implements IAbstractGraphQLResponse<CartItemEntity> { @Field(() => CartItemEntity, { nullable: true, description: "…" }) data: CartItemEntity }` |
| Case 3 | Tính nullable của `data` | luôn `nullable: true` — interceptor ghi `data = null` khi thất bại |
| Case 4 | Bảng của entity | mọi `@Entity` đều đặt tên bảng (lint `require-entity-table-name`, 181/181); không quan hệ `eager: true` |
