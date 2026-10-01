import type { HttpCaller, HttpRequestOptions, HttpResponse, TestHttp } from "./api"

const DEFAULT_TIMEOUT_MS = 20_000

/** What binds one client: the door's base URL (reserved by the run, never a literal), an optional bearer, the default deadline. */
export interface HttpClientSpec {
    readonly baseUrl: string
    readonly bearerToken?: string
    readonly timeoutMs?: number
}

const headersOf = (response: Response): Record<string, string> => {
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value
    })
    const cookies = response.headers.getSetCookie()
    if (cookies.length > 0) headers["set-cookie"] = cookies.join(", ")
    return headers
}

const parseBody = (text: string, contentType: string): unknown => {
    if (text === "") return ""
    if (/json/i.test(contentType)) {
        try {
            return JSON.parse(text) as unknown
        } catch {
            return text
        }
    }
    return text
}

/** The one HTTP client: refusals resolve, so a spec asserts the 4xx and never catches it. A Buffer body goes out as raw bytes, any other as JSON. */
export const createHttpClient = (spec: HttpClientSpec): HttpCaller => {
    const request = async <T>(method: string, path: string, body: unknown, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> => {
        const headers: Record<string, string> = { ...(spec.bearerToken === undefined ? {} : { authorization: `Bearer ${spec.bearerToken}` }) }
        let payload: RequestInit["body"]
        if (body instanceof Uint8Array) {
            payload = body as unknown as NonNullable<RequestInit["body"]>
            headers["content-type"] = "application/octet-stream"
        } else if (body !== undefined) {
            payload = JSON.stringify(body)
            headers["content-type"] = "application/json"
        }
        Object.assign(headers, options.headers ?? {})
        const target = new URL(path, spec.baseUrl)
        for (const [key, value] of Object.entries(options.params ?? {})) target.searchParams.set(key, String(value))
        const response = await fetch(target, {
            method,
            headers,
            body: payload,
            signal: AbortSignal.timeout(options.timeoutMs ?? spec.timeoutMs ?? DEFAULT_TIMEOUT_MS),
            redirect: "manual",
        })
        const text = await response.text()
        return { status: response.status, body: parseBody(text, response.headers.get("content-type") ?? "") as T, headers: headersOf(response) }
    }
    return {
        get: <T>(path: string, options?: HttpRequestOptions) => request<T>("GET", path, undefined, options),
        post: <T>(path: string, body?: unknown, options?: HttpRequestOptions) => request<T>("POST", path, body, options),
        put: <T>(path: string, body?: unknown, options?: HttpRequestOptions) => request<T>("PUT", path, body, options),
        delete: <T>(path: string, options?: HttpRequestOptions) => request<T>("DELETE", path, undefined, options),
    }
}

/** A REST client of an arbitrary URL (`world.http(url)`, `world.services.<name>.api`). */
export const createTestHttp = (baseUrl: string, bearerToken?: string): TestHttp => ({
    baseUrl,
    ...createHttpClient({ baseUrl, bearerToken }),
    as: (token) => createTestHttp(baseUrl, token),
})
