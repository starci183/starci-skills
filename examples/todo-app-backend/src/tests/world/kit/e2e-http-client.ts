import axios from "axios"
import type { AxiosInstance } from "axios"

/**
 * What any HTTP call came back with: status, the parsed body and the flattened response headers. Refusals resolve rather
 * than reject - a spec asserts the 4xx, never catches it.
 */
export interface E2EResponse<T = unknown> {
    readonly status: number
    readonly body: T
    readonly headers: Readonly<Record<string, string>>
}

/** The per-call knobs: extra headers for any verb. */
export interface E2EHttpRequestOptions {
    readonly headers?: Readonly<Record<string, string>>
}

/**
 * What one client binds: the door's base URL (allocated by the run, never a literal), an optional session bearer to preset
 * on every request, and the call timeout.
 */
export interface E2EHttpClientSpec {
    readonly baseUrl: string
    readonly bearerToken?: string
    readonly timeoutMs: number
}

/** The per-door HTTP handle a spec drives: real axios calls against this run's ports; every verb answers the same envelope. */
export interface E2EHttpClient {
    get<T = unknown>(path: string, options?: E2EHttpRequestOptions): Promise<E2EResponse<T>>
    post<T = unknown>(path: string, body?: unknown, options?: E2EHttpRequestOptions): Promise<E2EResponse<T>>
    put<T = unknown>(path: string, body?: unknown, options?: E2EHttpRequestOptions): Promise<E2EResponse<T>>
}

/**
 * The axios-per-door factory: one axios.create per (baseUrl, bearer) pair with `validateStatus: () => true`, so a refusal is
 * response data a spec asserts on rather than a rejection it must catch.
 */
export function createE2EHttpClient(spec: E2EHttpClientSpec): E2EHttpClient {
    const api: AxiosInstance = axios.create({
        baseURL: spec.baseUrl,
        timeout: spec.timeoutMs,
        validateStatus: () => true,
        headers: spec.bearerToken ? { authorization: `Bearer ${spec.bearerToken}` } : undefined,
    })

    const request = async <T>(
        method: string,
        path: string,
        body: unknown,
        options: E2EHttpRequestOptions,
    ): Promise<E2EResponse<T>> => {
        const response = await api.request<T>({
            method,
            url: path,
            data: body,
            headers: options.headers,
            timeout: spec.timeoutMs,
        })
        const headers: Record<string, string> = {}
        for (const [key, value] of Object.entries(response.headers)) {
            headers[key] = Array.isArray(value) ? value.join(", ") : String(value)
        }
        return { status: response.status, body: response.data, headers }
    }

    return {
        get: <T>(path: string, options: E2EHttpRequestOptions = {}) => request<T>("GET", path, undefined, options),
        post: <T>(path: string, body?: unknown, options: E2EHttpRequestOptions = {}) =>
            request<T>("POST", path, body, options),
        put: <T>(path: string, body?: unknown, options: E2EHttpRequestOptions = {}) =>
            request<T>("PUT", path, body, options),
    }
}
