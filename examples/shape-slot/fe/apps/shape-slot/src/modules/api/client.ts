import { appConfig } from "../config"
import { outcomeOfStatus, type Outcome } from "./outcome"

/** What a request says: a same-origin or absolute url, and the method and JSON body when it writes. */
export type RequestInput = {
    readonly url: string
    readonly method?: "GET" | "POST"
    readonly body?: unknown
}

/**
 * The only `fetch` of the app: the doors call it with a same-origin url and the server readers with an
 * absolute one. Every request carries a timeout combined with the caller's signal, and every status becomes
 * an `Outcome`; nothing here throws for an HTTP status. 401 and 403 are named `refused` before anything else
 * is looked at. The payload leaves as `unknown`: the caller validates the wire.
 */
export const request = async (input: RequestInput, signal?: AbortSignal): Promise<Outcome<unknown>> => {
    const timeout = AbortSignal.timeout(appConfig.requestTimeoutMs)
    try {
        const response = await fetch(input.url, {
            method: input.method ?? "GET",
            headers: input.body === undefined ? undefined : { "content-type": "application/json" },
            body: input.body === undefined ? undefined : JSON.stringify(input.body),
            signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
        })
        if (response.status === 401 || response.status === 403) {
            return { kind: "refused", status: response.status, code: `http-${response.status}` }
        }
        if (!response.ok) return outcomeOfStatus(response.status)
        const value: unknown = await response.json()
        return { kind: "ok", value }
    } catch {
        return { kind: "unavailable", code: "network", retryable: true }
    }
}
