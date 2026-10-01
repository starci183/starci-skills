/**
 * The transport clients of a booted app: the same doors a real client uses. GraphQL operations go to `/graphql` with a
 * session as bearer token; REST calls and raw byte bodies go through the same HTTP client. A refusal is data: every call
 * resolves with the status, the body and, for GraphQL, the declared error code on `errors[0].extensions.code`.
 */

/** What any HTTP call came back with. Refusals resolve rather than reject: a spec asserts the 4xx, never catches it. */
export interface HttpResponse<TBody = unknown> {
    readonly status: number
    readonly body: TBody
    /** Lower-cased header names; repeated headers are joined with `, `. */
    readonly headers: Readonly<Record<string, string>>
}

/** Per-call knobs. */
export interface HttpRequestOptions {
    /** Extra headers. */
    readonly headers?: Readonly<Record<string, string>>
    /** Query string parameters appended to the path. */
    readonly params?: Readonly<Record<string, string | number | boolean>>
    /** Deadline in milliseconds (default 20000). */
    readonly timeoutMs?: number
}

/** One GraphQL error as the spec observes it. */
export interface GraphqlErrorObserved {
    readonly message?: string
    readonly extensions?: Readonly<Record<string, unknown>>
}

/** The GraphQL-over-HTTP body as the wire carries it. */
export interface GraphqlWire<TData> {
    readonly data?: TData | null
    readonly errors?: ReadonlyArray<GraphqlErrorObserved> | null
}

/** What one GraphQL call came back with: data, or the refusal's declared code, next to the transport facts. */
export interface GraphqlObserved<TData> {
    readonly httpStatus: number
    readonly data: TData | null
    readonly errors: ReadonlyArray<GraphqlErrorObserved> | null
    /** `errors[0].extensions.code` when it is a string. */
    readonly errorCode: string | null
    readonly errorMessage: string | null
    readonly raw: unknown
    readonly durationMs: number
}

/** The HTTP verbs of a caller. A Buffer body goes out as raw bytes; any other body as JSON. */
export interface HttpCaller {
    get<T = unknown>(path: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>
    post<T = unknown>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>>
    put<T = unknown>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>>
    delete<T = unknown>(path: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>
}

/** A caller of an app (anonymous or bound to a bearer): REST plus GraphQL. */
export interface TestCaller extends HttpCaller {
    /** Sends one GraphQL operation: `operation` is a key of the app's `operations` registry or a document string; `language` sets `accept-language`. */
    graphql<TData>(operation: string, variables?: Record<string, unknown>, language?: string): Promise<GraphqlObserved<TData>>
    /** Sends a query document (registry key or string). */
    read<TData>(operation: string, options?: { readonly variables?: Record<string, unknown> }): Promise<GraphqlObserved<TData>>
    /** Sends a mutation document (registry key or string). */
    mutate<TData>(operation: string, options?: { readonly variables?: Record<string, unknown> }): Promise<GraphqlObserved<TData>>
}

/** The api of one listening app: an anonymous caller plus the way to act as a session. */
export interface TestApi extends TestCaller {
    /** The loopback base URL the app listens on. */
    readonly baseUrl: string
    /** A caller that carries this token as its bearer. */
    as(sessionToken: string): TestCaller
    /** The same door with every call riding on `token`; without a token every call is anonymous (`as` under the name the ecommerce specs use). */
    bearing(token?: string): TestCaller
    /** Signs in through the public door the repository declared in `identity.signIn`; a refusal is a world failure. */
    signIn(email: string, password: string): Promise<{ readonly sessionToken: string; readonly personId: string }>
}

/** A REST-only client for a URL that is not a booted app (a sibling service, a k3d service, an external door). */
export interface TestHttp extends HttpCaller {
    readonly baseUrl: string
    /** The same client riding on a bearer. */
    as(token: string): TestHttp
}
