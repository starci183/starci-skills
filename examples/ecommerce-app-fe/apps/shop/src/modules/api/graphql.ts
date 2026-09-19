import "server-only"
import { REQUEST_TIMEOUT_MS } from "../config"

/**
 * The extensions envelope a GraphQL error carries. The backend's `formatError` writes the stable
 * business code (`SESSION_INVALID`, `CHECKOUT_REFUSAL`, ...) onto `code` and spreads the
 * exception's metadata beside it, so a refusal's `reason`, `productId`, `requested` and
 * `available` survive the trip.
 */
export type GraphqlExtensions = { readonly code?: string } & Record<string, unknown>

/**
 * What one GraphQL call returns: the payload, or the refusal. `code`/`extensions` ride beside the
 * human reason so a caller can tell a named business refusal from a transport failure. The failed
 * branch is a superset of `Result`'s, so a caller that only wants `ok`/`reason` can still take it.
 */
export type GraphqlResult<T> =
    | { readonly ok: true; readonly data: T }
    | { readonly ok: false; readonly reason: string; readonly code?: string; readonly extensions?: GraphqlExtensions };

type GraphqlEnvelope<T> = {
    readonly data?: T | null
    readonly errors?: ReadonlyArray<{
        readonly message?: string
        readonly extensions?: GraphqlExtensions
    }>
}

/** Turn whatever `fetch`/`json` threw into one human-readable clause, same bargain as `http.ts`. */
const describe = (error: unknown): string => {
    if (error instanceof Error) {
        if (error.name === "AbortError") return "the service did not answer in time"
        return error.message
    }
    return "the request failed"
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
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(`${baseUrl}/graphql`, {
            method: "POST",
            cache: "no-store",
            signal: controller.signal,
            headers: {
                "content-type": "application/json",
                ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
            },
            body: JSON.stringify({ query: operation, ...(variables ? { variables } : {}) }),
        })
        if (!response.ok) {
            return { ok: false, reason: `the service responded ${response.status}` }
        }
        const body = (await response.json()) as GraphqlEnvelope<T>
        const error = body.errors?.[0]
        if (error) {
            return {
                ok: false,
                reason: error.message ?? "the service refused the request",
                code: typeof error.extensions?.code === "string" ? error.extensions.code : undefined,
                extensions: error.extensions,
            }
        }
        if (body.data == null) {
            return { ok: false, reason: "the service answered without data" }
        }
        return { ok: true, data: body.data }
    } catch (error) {
        return { ok: false, reason: describe(error) }
    } finally {
        clearTimeout(timer)
    }
}
