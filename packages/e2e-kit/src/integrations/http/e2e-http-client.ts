import axios, {
    AxiosInstance, AxiosResponse 
} from "axios"
import {
    GraphqlObserved, graphqlEnvelopeOf 
} from "../graphql/graphql-envelope"

/**
 * What any HTTP call came back with: status, the parsed body under both names (`body` is the
 * wire fact, `data` the spelling specs reach for), the flattened response headers and the
 * wall time. Refusals resolve rather than reject - a spec asserts the 4xx, never catches it.
 */
export interface E2EResponse<T = unknown> {
  readonly status: number;
  readonly body: T;
  /** Alias of `body` - both names resolve to the same parsed payload. */
  readonly data: T;
  readonly durationMs: number;
  readonly headers: Record<string, string>;
}

/** The per-call knobs: query params for GET-style doors, extra headers for any verb. */
export interface E2EHttpRequestOptions {
  readonly params?: Record<string, string>;
  readonly headers?: Record<string, string>;
}

/**
 * What one client binds: the door's base URL (allocated by the run's stack service, never a
 * literal), an optional session bearer to preset on every request, and an optional call
 * timeout - omitted means axios's own default of no client-side timeout.
 */
export interface E2EHttpClientSpec {
  readonly baseUrl: string;
  readonly bearerToken?: string;
  readonly timeoutMs?: number;
}

/**
 * The per-door HTTP handle a spec drives: real axios calls against this run's ports. Every
 * verb answers the same E2EResponse envelope; `graphql` is the convenience for the common
 * case of one GraphQL document POSTed to the door's /graphql endpoint.
 */
export interface E2EHttpClient {
  readonly baseUrl: string;
  get<T = unknown>(path: string, options?: E2EHttpRequestOptions): Promise<E2EResponse<T>>;
  delete<T = unknown>(path: string, options?: E2EHttpRequestOptions): Promise<E2EResponse<T>>;
  post<T = unknown>(path: string, body?: unknown, options?: E2EHttpRequestOptions): Promise<E2EResponse<T>>;
  put<T = unknown>(path: string, body?: unknown, options?: E2EHttpRequestOptions): Promise<E2EResponse<T>>;
  patch<T = unknown>(path: string, body?: unknown, options?: E2EHttpRequestOptions): Promise<E2EResponse<T>>;
  postForm<T = unknown>(path: string, form: Record<string, string>): Promise<E2EResponse<T>>;
  graphql<TData = Record<string, unknown>>(query: string, variables?: Record<string, unknown>): Promise<GraphqlObserved<TData>>;
}

/**
 * The axios-per-door factory every app's http service wraps: one axios.create per
 * (baseUrl, bearer) pair with `validateStatus: () => true`, so a refusal is response data a
 * spec asserts on rather than a rejection it must catch.
 */
export function createE2EHttpClient(spec: E2EHttpClientSpec): E2EHttpClient {
    const api: AxiosInstance = axios.create({
        baseURL: spec.baseUrl,
        timeout: spec.timeoutMs ?? 0,
        validateStatus: () => true,
        headers: spec.bearerToken ? {
            authorization: `Bearer ${spec.bearerToken}` 
        } : undefined,
    })

    const request = async <T>(
        method: string,
        path: string,
        body: unknown,
        options: E2EHttpRequestOptions,
    ): Promise<E2EResponse<T>> => {
        const startedAt = Date.now()
        const response: AxiosResponse<T> = await api.request({
            method,
            url: path,
            data: body,
            params: options.params,
            headers: options.headers,
        })
        return wrapResponse(response,
            startedAt)
    }

    return {
        baseUrl: spec.baseUrl,
        get: <T>(path: string, options: E2EHttpRequestOptions = {
        }) => request<T>("GET",
            path,
            undefined,
            options),
        delete: <T>(path: string, options: E2EHttpRequestOptions = {
        }) => request<T>("DELETE",
            path,
            undefined,
            options),
        post: <T>(path: string, body?: unknown, options: E2EHttpRequestOptions = {
        }) => request<T>("POST",
            path,
            body,
            options),
        put: <T>(path: string, body?: unknown, options: E2EHttpRequestOptions = {
        }) => request<T>("PUT",
            path,
            body,
            options),
        patch: <T>(path: string, body?: unknown, options: E2EHttpRequestOptions = {
        }) => request<T>("PATCH",
            path,
            body,
            options),
        postForm: <T>(path: string, form: Record<string, string>) => request<T>("POST",
            path,
            new URLSearchParams(form).toString(),
            {
                headers: {
                    "content-type": "application/x-www-form-urlencoded" 
                } 
            }),
        graphql: async <TData>(query: string, variables?: Record<string, unknown>) => {
            const startedAt = Date.now()
            const response = await request<Record<string, unknown>>("POST",
                "/graphql",
                {
                    query, variables: variables ?? {
                    } 
                },
                {
                })
            return graphqlEnvelopeOf<TData>(response.status,
                response.data,
                startedAt)
        },
    }
}

/** Flattens one AxiosResponse into the spec-facing envelope (headers become a plain map). */
function wrapResponse<T>(response: AxiosResponse<T>, startedAt: number): E2EResponse<T> {
    const headers: Record<string, string> = {
    }
    for (const [key,
        value] of Object.entries(response.headers ?? {
        })) {
        headers[key] = Array.isArray(value) ? value.join(", ") : String(value)
    }
    return {
        status: response.status,
        body: response.data,
        data: response.data,
        durationMs: Date.now() - startedAt,
        headers,
    }
}
