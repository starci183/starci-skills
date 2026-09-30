import type { Outcome } from "./outcome"

/** How long a request waits before it is abandoned and answered `unavailable`. */
const REQUEST_TIMEOUT_MS = 8000

/** One request of the client: the caller's own signal is joined with the timeout. */
export interface ClientRequest {
    readonly url: string
    readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    readonly body?: unknown
    readonly signal?: AbortSignal
}

/** The status of a response as an Outcome kind; 401 and 403 are `refused`, nothing collapses into `null`. */
const toOutcome = async (response: Response): Promise<Outcome<unknown>> => {
    if (response.status === 401 || response.status === 403) return { kind: "refused" }
    if (response.status === 404) return { kind: "not-found" }
    if (response.status === 400 || response.status === 422) return { kind: "invalid" }
    if (!response.ok) return { kind: "unavailable" }
    try {
        return { kind: "ok", data: (await response.json()) as unknown }
    } catch {
        return { kind: "unavailable" }
    }
}

/**
 * The repository's one fetch. It always carries a timeout signal, never throws, and answers an Outcome; the body is
 * `unknown` until a generated wire type narrows it.
 */
export const request = async ({ url, method = "GET", body, signal }: ClientRequest): Promise<Outcome<unknown>> => {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(url, {
            method,
            headers: { accept: "application/json", ...(body === undefined ? {} : { "content-type": "application/json" }) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
        })
        return await toOutcome(response)
    } catch {
        return { kind: "unavailable" }
    }
}
