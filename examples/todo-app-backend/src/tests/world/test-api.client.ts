/**
 * The transport client of a listening app: the same doors a real client uses. GraphQL operations go to `/graphql` with the
 * session as a bearer token and an optional `accept-language`; REST calls (health, metrics, the upload byte stream, the
 * signed webhook) and raw byte bodies go through axios against the loopback port the app listens on. A refusal is data:
 * every call resolves with the status, the body and, for GraphQL, the declared error code.
 */
import { graphqlEnvelopeOf } from "@e2e-kit/integrations/graphql/graphql-envelope"
import type { GraphqlObserved } from "@e2e-kit/integrations/graphql/graphql-envelope"
import { createE2EHttpClient } from "@e2e-kit/integrations/http/e2e-http-client"
import type { E2EHttpRequestOptions, E2EResponse } from "@e2e-kit/integrations/http/e2e-http-client"
import type { SignInData } from "@tests/fixtures/views/e2e-views.contracts"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import { TODO_OPERATIONS } from "./todo-operations.contracts"
import type { TodoOperation } from "./todo-operations.contracts"

const CALL_TIMEOUT_MS = 20_000

/** One identity the sign-in door granted. */
export interface TestSession {
    /** The bearer token of the session. */
    readonly sessionToken: string
    /** The person the session belongs to. */
    readonly personId: string
}

/** What one caller (anonymous or bound to a bearer) can do against the api. */
export interface TestCaller {
    /** Sends one GraphQL operation by its registry name; `language` sets `accept-language`. */
    graphql<TData>(operation: TodoOperation, variables?: Record<string, unknown>, language?: string): Promise<GraphqlObserved<TData>>
    /** A REST GET. */
    get<T>(path: string, options?: E2EHttpRequestOptions): Promise<E2EResponse<T>>
    /** A REST POST; a Buffer body goes out as raw bytes. */
    post<T>(path: string, body?: unknown, options?: E2EHttpRequestOptions): Promise<E2EResponse<T>>
    /** A REST PUT; a Buffer body goes out as raw bytes. */
    put<T>(path: string, body?: unknown, options?: E2EHttpRequestOptions): Promise<E2EResponse<T>>
}

/** The api of one listening app: an anonymous caller plus the way to act as a session. */
export interface TestApi extends TestCaller {
    /** The loopback base URL the app listens on. */
    readonly baseUrl: string
    /** A caller that carries this session token as its bearer. */
    as(sessionToken: string): TestCaller
    /** Signs in through the public door; a refusal is a world failure (a spec asserting a refusal calls `graphql("signIn", ...)` itself). */
    signIn(email: string, password: string): Promise<TestSession>
}

const callerOf = (baseUrl: string, sessionToken?: string): TestCaller => {
    const http = createE2EHttpClient({ baseUrl, bearerToken: sessionToken, timeoutMs: CALL_TIMEOUT_MS })
    return {
        graphql: async <TData>(
            operation: TodoOperation,
            variables?: Record<string, unknown>,
            language?: string,
        ): Promise<GraphqlObserved<TData>> => {
            const startedAt = Date.now()
            const headers = language === undefined ? {} : { "accept-language": language }
            const response = await http.post<Record<string, unknown>>(
                "/graphql",
                { query: TODO_OPERATIONS[operation], variables: variables ?? {} },
                { headers },
            )
            return graphqlEnvelopeOf<TData>(response.status, response.body, startedAt)
        },
        get: <T>(path: string, options?: E2EHttpRequestOptions) => http.get<T>(path, options),
        post: <T>(path: string, body?: unknown, options?: E2EHttpRequestOptions) => http.post<T>(path, body, options),
        put: <T>(path: string, body?: unknown, options?: E2EHttpRequestOptions) => http.put<T>(path, body, options),
    }
}

/** Builds the api client of the app listening at `baseUrl`. */
export const createTestApi = (baseUrl: string): TestApi => {
    const anonymous = callerOf(baseUrl)
    return {
        ...anonymous,
        baseUrl,
        as: (sessionToken) => callerOf(baseUrl, sessionToken),
        signIn: async (email, password) => {
            const observed = await anonymous.graphql<SignInData>("signIn", { input: { email, password } })
            if (observed.data === null) {
                throw new TestWorldError({
                    code: TestWorldErrorCode.SignInRefused,
                    params: { detail: `${email}: ${observed.errorCode ?? "no data"}` },
                })
            }
            return { sessionToken: observed.data.signIn.sessionToken, personId: observed.data.signIn.personId }
        },
    }
}
