import { config } from "../config"
import { outcomeOfStatus, type Outcome } from "./outcome"

/** What a request says: a path under the API base, and the method and JSON body when it writes. */
export type RequestInput = {
    readonly path: string
    readonly method?: "GET" | "POST"
    readonly body?: unknown
}

/**
 * The only `fetch` of the app. Every request carries a timeout combined with the caller's signal, and every
 * status becomes an `Outcome`; nothing here throws for an HTTP status.
 */
export const request = async <T,>(input: RequestInput, signal?: AbortSignal): Promise<Outcome<T>> => {
    const timeout = AbortSignal.timeout(config.requestTimeoutMs)
    try {
        const response = await fetch(`${config.apiBaseUrl}${input.path}`, {
            method: input.method ?? "GET",
            headers: input.body === undefined ? undefined : { "content-type": "application/json" },
            body: input.body === undefined ? undefined : JSON.stringify(input.body),
            signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
        })
        if (!response.ok) return outcomeOfStatus(response.status)
        return { kind: "ok", value: (await response.json()) as T }
    } catch {
        return { kind: "unavailable", code: "network", retryable: true }
    }
}
