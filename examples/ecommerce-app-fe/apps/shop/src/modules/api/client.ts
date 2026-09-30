import type { GraphqlExtensions, GraphqlResult, Result } from "./outcome"

/** How long a call waits before the caller falls back to its empty state. */
const REQUEST_TIMEOUT_MS = 2500

/** Turn whatever `fetch`/`json` threw into one human-readable clause for the empty state. */
const describe = (error: unknown): string => {
    if (error instanceof Error) {
        if (error.name === "AbortError") return "the service did not answer in time"
        return error.message
    }
    return "the request failed"
}

/** The flat refusal body the backend's business-code filter stamps on a non-2xx answer. */
type RefusalBody = {
    readonly code?: unknown
    readonly message?: unknown
}

/** One HTTP exchange: the response with its JSON body (`null` when unreadable), or why there was none. */
type Exchange =
    | { readonly ok: true; readonly response: Response; readonly body: unknown }
    | { readonly ok: false; readonly reason: string }

/**
 * The one place raw `fetch` is allowed (the same transport-singleton rule `todo-app-frontend` and
 * nivo-fe both keep): every read and write - a backend service or the shop's own session door -
 * reaches the network through a named call in this file, never by calling `fetch` itself.
 *
 * Never throws. During a server render the service may be down or the port unallocated, and a
 * stack trace is a worse answer than "there is nothing to show yet, because X" - which is what the
 * caller gets back.
 */
const exchange = async (url: string, init: RequestInit): Promise<Exchange> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(url, { cache: "no-store", ...init, signal: controller.signal })
        return { ok: true, response, body: await response.json().catch(() => null) }
    } catch (error) {
        return { ok: false, reason: describe(error) }
    } finally {
        clearTimeout(timer)
    }
}

/**
 * Settle an exchange as a `Result`. A refused request lifts the flat `{code, message}` body the
 * backend's business-code filter stamps (`REQUEST_INVALID`, `SESSION_INVALID`, ...) onto the
 * result, so a caller can tell a typed refusal from an outage without parsing the status.
 */
const settle = <T>(answer: Exchange): Result<T> => {
    if (!answer.ok) return answer
    if (!answer.response.ok) {
        const refused = answer.body as RefusalBody | null
        return {
            ok: false,
            reason: typeof refused?.message === "string" ? refused.message : `the service responded ${answer.response.status}`,
            code: typeof refused?.code === "string" ? refused.code : undefined,
        }
    }
    if (answer.body === null) return { ok: false, reason: "the service answered without a readable body" }
    return { ok: true, data: answer.body as T }
}

/** The JSON-body request shape every write here shares. */
const jsonRequest = (method: "POST" | "DELETE", body?: unknown): RequestInit => ({
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

/**
 * POST a JSON body to a door - the shape the identity service's `internal/sessions/*` machine
 * doors and the shop's own `/api/session` door take.
 */
export const postJson = async <T>(url: string, body: unknown): Promise<Result<T>> =>
    settle<T>(await exchange(url, jsonRequest("POST", body)))

/** DELETE at a door: the shop's own `/api/session` door answers a bare `{ ok: true }`. */
export const deleteJson = async <T>(url: string): Promise<Result<T>> =>
    settle<T>(await exchange(url, jsonRequest("DELETE")))

type GraphqlEnvelope<T> = {
    readonly data?: T | null
    readonly errors?: ReadonlyArray<{
        readonly message?: string
        readonly extensions?: GraphqlExtensions
    }>
}

/**
 * The one door both backend services share: `POST {baseUrl}/graphql`. Never throws - during a
 * server render the service may be down, and the first GraphQL error's message plus extensions are
 * the honest refusal the caller renders. The bearer session token travels on `authorization`
 * exactly as the order service's SessionGuard reads it; callers pass null where the door is open.
 */
export const postGraphql = async <T>(
    baseUrl: string,
    operation: string,
    variables: Record<string, unknown> | undefined,
    sessionToken: string | null,
): Promise<GraphqlResult<T>> => {
    const answer = await exchange(`${baseUrl}/graphql`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({ query: operation, ...(variables ? { variables } : {}) }),
    })
    if (!answer.ok) return answer
    if (!answer.response.ok) {
        return { ok: false, reason: `the service responded ${answer.response.status}` }
    }
    const body = answer.body as GraphqlEnvelope<T> | null
    const error = body?.errors?.[0]
    if (error) {
        return {
            ok: false,
            reason: error.message ?? "the service refused the request",
            code: typeof error.extensions?.code === "string" ? error.extensions.code : undefined,
            extensions: error.extensions,
        }
    }
    if (body?.data == null) {
        return { ok: false, reason: "the service answered without data" }
    }
    return { ok: true, data: body.data }
}
