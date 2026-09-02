# Error

This file answers one question: given a failure in the backend, how is it declared, thrown,
wrapped, logged, and mapped onto HTTP and GraphQL?

Sources: `modules/platform/exceptions/errors/abstract.ts`, `errors/ai/ai-quota-exhausted.ts`,
`errors/courses/challenge-not-found.ts`, `errors/api/graphql.ts`,
`modules/platform/exceptions/filters/abstract-exception-http.filter.ts`,
`apps/core/src/app.module.ts`,
`modules/api/apollo/server/interceptors/graphql-transform.interceptor.ts`,
`modules/api/apollo/server/monolithic/monolithic-apollo-server.module.ts`,
`modules/api/apollo/server/types/graphql-response.ts`,
`features/api/core/graphql/mutations/courses/add-to-cart/add-to-cart.handler.ts`.

Verified: 294 files under `errors/**` declare a class that `extends AbstractException`; the only
class extending `Error` directly is `AbstractException` itself; lint `throw-abstract-exception`,
`exception-extends-abstract` and `exception-in-errors-folder` are at error for `src/**` and off
only under `src/tests/**` and `apps/*/test/**`.

## BE-ERROR-1 — The base

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Shape | `export class AbstractException extends Error { readonly code: string; readonly metadata?: Record<string, unknown>; readonly httpStatus?: number; constructor(message: string, name: string, metadata?: Record<string, unknown>, httpStatus?: number) { super(message); this.code = name; this.name = name; this.metadata = metadata; this.httpStatus = httpStatus } … }` |
| Case 2 | Serialisation | `toJSON(): string` → `{ message, code, metadata }`; `static fromJSON<T extends AbstractException>(…)` |
| Case 3 | Cause | `getOriginalError(): Error { return this.metadata?.originalError as Error }`; `export interface AbstractExceptionMetadata { originalError?: Error }` |
| Case 4 | Status | `httpStatus` is optional; undefined means 500 at both transports |

## BE-ERROR-2 — Declaring one exception

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Metadata interface first | `export interface ChallengeNotFoundExceptionMetadata extends AbstractExceptionMetadata { id?: string }` |
| Case 2 | Class | `export class ChallengeNotFoundException extends AbstractException { constructor({ id, originalError }: ChallengeNotFoundExceptionMetadata) { super("Challenge not found", "CHALLENGE_NOT_FOUND_EXCEPTION", { id, originalError }) } }` |
| Case 3 | Interpolated message | `` super(`AI quota exhausted (${window})`, "AI_QUOTA_EXHAUSTED_EXCEPTION", { window, originalError }) `` |
| Case 4 | With a status | fourth argument `HttpStatus.<X>` — set in 94 of 294 files, left undefined in the rest |
| Case 5 | Single object argument | always one metadata object, even when empty: `throw new UserNotFoundException({})` (lint `require-exception-object-arg`) |

## BE-ERROR-3 — Throwing

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Guard in a handler | `if (!courseExists) { throw new CourseNotFoundException({ id: courseId }) }` |
| Case 2 | Conflict | `throw new CourseAlreadyEnrolledException({ courseId, userId: user.id })` |
| Case 3 | Never encode failure in the return | a handler resolves to the entity or throws; `success: false` appears in 1 of 154 handlers (lint `no-handler-encoded-failure`) |
| Case 4 | Never `new Error` | `NewExpression[callee.name="Error"]` is banned in `src/**` outside the test lanes |

## BE-ERROR-4 — Wrapping a foreign error

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Crypto | `catch (error) { throw new DecryptionFailedException({ originalError: error instanceof Error ? error : new Error(String(error)) }) }` (25 non-exception files wrap this way) |
| Case 2 | Cursor parsing | `catch (error) { throw new CourseCommunityCursorException({ originalError: error as Error }) }` |
| Case 3 | At-least-once consumer | `catch (error) { const exception = new KafkaCdcMessageException({ topic, originalError: error instanceof Error ? error : undefined }); … log and continue }` |
| Case 4 | Upstream GraphQL | `GraphQLDataNotFoundException({ query, variables, url, originalError })` |

## BE-ERROR-5 — HTTP mapping

| Case | When | Write |
| --- | --- | --- |
| Case 1 | The filter | `@Catch(AbstractException) export class AbstractExceptionHttpFilter implements ExceptionFilter { catch(exception: AbstractException, host: ArgumentsHost): void { if (host.getType<string>() === "graphql") { throw exception } const status = exception.httpStatus ?? HttpStatus.INTERNAL_SERVER_ERROR; … response.status(status).json({ statusCode: status, code: exception.code, message: exception.message }) } }` |
| Case 2 | Registration | `apps/core/src/app.module.ts`: `{ provide: APP_FILTER, useClass: AbstractExceptionHttpFilter }` |
| Case 3 | Logged before responding | `this.winstonService.log(WinstonLog.HttpExceptionLogged, { op: "http.exception.logged", error: exception.message, meta: { code: exception.code, status } })` |
| Case 4 | GraphQL host | rethrown untouched so Apollo's pipeline owns it |

## BE-ERROR-6 — GraphQL mapping

Two layers. The interceptor shapes the resolver's body; `formatError` shapes the GraphQL `errors`
entry and the transport status.

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Success envelope | `GraphQLTransformInterceptor` maps every resolver result to `{ data, message, success: true }` with `message` from `@GraphQLSuccessMessage({ [Locale.En]: "…", [Locale.Vi]: "…" })` resolved by locale |
| Case 2 | Failure envelope | `catchError((err) => … observer.next({ success: false, message: err?.message ?? "Internal server error", error: err?.name ?? "Error" }))` — `error` carries the exception `code` because `AbstractException` sets `this.name = name` |
| Case 3 | `formatError` | in `MonolithicApolloServerModule`: `if (original instanceof AbstractException) { return { ...formattedError, extensions: { ...formattedError.extensions, code: original.code, http: { status: original.httpStatus ?? 500 }, …retryAfterSeconds } } }` |
| Case 4 | Everything else | `return { ...formattedError, extensions: { ...formattedError.extensions, http: { status: 500, ...(formattedError.extensions?.http as ApolloHttpExtension \| undefined) } } }` |
| Case 5 | Transport status | `httpStatusFromExceptionsPlugin` reads `extensions.http.status` and sets the real HTTP status |
| Case 6 | Client contract | `interface GraphQLResponse<T = unknown> { data?: T; message: string; success: boolean; error?: string }`; the FE matches on `error` code, not on status |

## BE-ERROR-7 — Logging a failure

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Identity | an enum member: `WinstonLog.HttpExceptionLogged` (lint `no-interpolated-log-message`, `no-error-wording-as-log-identity`) |
| Case 2 | Payload | `{ op: "http.exception.logged", error: exception.message, meta: { code, status } }` |
| Case 3 | Never | `console.error`, Nest `Logger` |
