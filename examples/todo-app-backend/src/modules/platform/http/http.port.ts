/** The HTTP methods the client sends. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/** One outbound request. The timeout is required: a call without a deadline does not type-check. */
export interface HttpRequest {
    /** The HTTP method. */
    readonly method: HttpMethod
    /** The absolute URL. */
    readonly url: string
    /** Extra request headers. */
    readonly headers?: Readonly<Record<string, string>>
    /** A JSON-serializable body, sent as `application/json`. */
    readonly body?: unknown
    /** Form fields, sent as `application/x-www-form-urlencoded`; use either `body` or `form`, not both. */
    readonly form?: Readonly<Record<string, string>>
    /** How long to wait for the answer before the call fails as a timeout. */
    readonly timeoutMs: number
    /** Cancels the call when aborted. */
    readonly signal?: AbortSignal
}

/** The answer to one request: the status and the body parsed as JSON (undefined when the body is empty). */
export interface HttpResponse {
    /** The HTTP status code. */
    readonly status: number
    /** The parsed JSON body, undefined when the answer had none. */
    readonly body: unknown
}

/** The outbound HTTP port: the only way product code calls another service. */
export interface HttpClient {
    /** Sends `request`; rejects with an HttpError on a network failure, a timeout or an unreadable body. */
    request(request: HttpRequest): Promise<HttpResponse>
}
