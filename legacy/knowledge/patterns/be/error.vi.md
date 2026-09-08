# Lỗi

Tệp này trả lời một câu hỏi: cho một thất bại trong backend, nó được khai báo, ném, bọc, ghi log,
và ánh xạ sang HTTP và GraphQL thế nào?

Nguồn: `modules/platform/exceptions/errors/abstract.ts`, `errors/ai/ai-quota-exhausted.ts`,
`errors/courses/challenge-not-found.ts`, `errors/api/graphql.ts`,
`modules/platform/exceptions/filters/abstract-exception-http.filter.ts`,
`apps/core/src/app.module.ts`,
`modules/api/apollo/server/interceptors/graphql-transform.interceptor.ts`,
`modules/api/apollo/server/monolithic/monolithic-apollo-server.module.ts`,
`modules/api/apollo/server/types/graphql-response.ts`,
`features/api/core/graphql/mutations/courses/add-to-cart/add-to-cart.handler.ts`.

Đã kiểm chứng: 294 tệp dưới `errors/**` khai báo một lớp `extends AbstractException`; lớp duy nhất
kế thừa thẳng `Error` là chính `AbstractException`; lint `throw-abstract-exception`,
`exception-extends-abstract` và `exception-in-errors-folder` ở mức error cho `src/**` và chỉ tắt
dưới `src/tests/**` và `apps/*/test/**`.

## BE-ERROR-1 — Lớp gốc

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Hình dạng | `export class AbstractException extends Error { readonly code: string; readonly metadata?: Record<string, unknown>; readonly httpStatus?: number; constructor(message: string, name: string, metadata?: Record<string, unknown>, httpStatus?: number) { super(message); this.code = name; this.name = name; this.metadata = metadata; this.httpStatus = httpStatus } … }` |
| Case 2 | Tuần tự hóa | `toJSON(): string` → `{ message, code, metadata }`; `static fromJSON<T extends AbstractException>(…)` |
| Case 3 | Nguyên nhân | `getOriginalError(): Error { return this.metadata?.originalError as Error }`; `export interface AbstractExceptionMetadata { originalError?: Error }` |
| Case 4 | Mã trạng thái | `httpStatus` là tùy chọn; không định nghĩa nghĩa là 500 ở cả hai tầng vận chuyển |

## BE-ERROR-2 — Khai báo một exception

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Interface metadata trước | `export interface ChallengeNotFoundExceptionMetadata extends AbstractExceptionMetadata { id?: string }` |
| Case 2 | Lớp | `export class ChallengeNotFoundException extends AbstractException { constructor({ id, originalError }: ChallengeNotFoundExceptionMetadata) { super("Challenge not found", "CHALLENGE_NOT_FOUND_EXCEPTION", { id, originalError }) } }` |
| Case 3 | Thông điệp nội suy | `` super(`AI quota exhausted (${window})`, "AI_QUOTA_EXHAUSTED_EXCEPTION", { window, originalError }) `` |
| Case 4 | Có mã trạng thái | đối số thứ tư `HttpStatus.<X>` — được đặt ở 94 trên 294 tệp, bỏ trống ở phần còn lại |
| Case 5 | Một đối số object duy nhất | luôn là một object metadata, kể cả khi rỗng: `throw new UserNotFoundException({})` (lint `require-exception-object-arg`) |

## BE-ERROR-3 — Ném

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Chốt chặn trong handler | `if (!courseExists) { throw new CourseNotFoundException({ id: courseId }) }` |
| Case 2 | Xung đột | `throw new CourseAlreadyEnrolledException({ courseId, userId: user.id })` |
| Case 3 | Không bao giờ mã hóa thất bại vào giá trị trả về | handler trả entity hoặc ném; `success: false` xuất hiện ở 1 trên 154 handler (lint `no-handler-encoded-failure`) |
| Case 4 | Không bao giờ `new Error` | `NewExpression[callee.name="Error"]` bị cấm trong `src/**` ngoài các làn kiểm thử |

## BE-ERROR-4 — Bọc một lỗi bên ngoài

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Mã hóa | `catch (error) { throw new DecryptionFailedException({ originalError: error instanceof Error ? error : new Error(String(error)) }) }` (25 tệp ngoài cây exception bọc theo cách này) |
| Case 2 | Phân tích con trỏ | `catch (error) { throw new CourseCommunityCursorException({ originalError: error as Error }) }` |
| Case 3 | Bên tiêu thụ ít-nhất-một-lần | `catch (error) { const exception = new KafkaCdcMessageException({ topic, originalError: error instanceof Error ? error : undefined }); … ghi log và tiếp tục }` |
| Case 4 | GraphQL thượng nguồn | `GraphQLDataNotFoundException({ query, variables, url, originalError })` |

## BE-ERROR-5 — Ánh xạ HTTP

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Bộ lọc | `@Catch(AbstractException) export class AbstractExceptionHttpFilter implements ExceptionFilter { catch(exception: AbstractException, host: ArgumentsHost): void { if (host.getType<string>() === "graphql") { throw exception } const status = exception.httpStatus ?? HttpStatus.INTERNAL_SERVER_ERROR; … response.status(status).json({ statusCode: status, code: exception.code, message: exception.message }) } }` |
| Case 2 | Đăng ký | `apps/core/src/app.module.ts`: `{ provide: APP_FILTER, useClass: AbstractExceptionHttpFilter }` |
| Case 3 | Ghi log trước khi phản hồi | `this.winstonService.log(WinstonLog.HttpExceptionLogged, { op: "http.exception.logged", error: exception.message, meta: { code: exception.code, status } })` |
| Case 4 | Host GraphQL | ném lại nguyên vẹn để đường ống của Apollo sở hữu nó |

## BE-ERROR-6 — Ánh xạ GraphQL

Hai lớp. Interceptor định hình thân trả về của resolver; `formatError` định hình mục `errors` của
GraphQL và mã trạng thái vận chuyển.

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Phong bì thành công | `GraphQLTransformInterceptor` ánh xạ mọi kết quả resolver thành `{ data, message, success: true }` với `message` lấy từ `@GraphQLSuccessMessage({ [Locale.En]: "…", [Locale.Vi]: "…" })` giải theo locale |
| Case 2 | Phong bì thất bại | `catchError((err) => … observer.next({ success: false, message: err?.message ?? "Internal server error", error: err?.name ?? "Error" }))` — `error` mang `code` của exception vì `AbstractException` đặt `this.name = name` |
| Case 3 | `formatError` | trong `MonolithicApolloServerModule`: `if (original instanceof AbstractException) { return { ...formattedError, extensions: { ...formattedError.extensions, code: original.code, http: { status: original.httpStatus ?? 500 }, …retryAfterSeconds } } }` |
| Case 4 | Mọi thứ khác | `return { ...formattedError, extensions: { ...formattedError.extensions, http: { status: 500, ...(formattedError.extensions?.http as ApolloHttpExtension \| undefined) } } }` |
| Case 5 | Mã trạng thái vận chuyển | `httpStatusFromExceptionsPlugin` đọc `extensions.http.status` và đặt mã HTTP thật |
| Case 6 | Hợp đồng với client | `interface GraphQLResponse<T = unknown> { data?: T; message: string; success: boolean; error?: string }`; FE so khớp theo mã trong `error`, không theo mã trạng thái |

## BE-ERROR-7 — Ghi log một thất bại

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Danh tính | một thành viên enum: `WinstonLog.HttpExceptionLogged` (lint `no-interpolated-log-message`, `no-error-wording-as-log-identity`) |
| Case 2 | Payload | `{ op: "http.exception.logged", error: exception.message, meta: { code, status } }` |
| Case 3 | Không bao giờ | `console.error`, `Logger` của Nest |
