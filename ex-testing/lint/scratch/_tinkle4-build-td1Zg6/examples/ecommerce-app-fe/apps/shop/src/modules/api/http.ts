import { REQUEST_TIMEOUT_MS } from "../config"
import type { Result } from "./result"

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

/**
 * The one place raw `fetch` for a backend service is allowed (the same transport-singleton rule
 * `todo-app-frontend` and nivo-fe both keep): every page reaches the network through a named call in
 * `catalog.ts`/`orders.ts`/`identity.ts`, never by calling `fetch` itself.
 *
 * Never throws. During a server render the service may be down or the port unallocated, and a stack trace
 * is a worse answer than "there is nothing to show yet, because X" — which is what the caller gets back.
 */
export const getJson = async <T>(url: string): Promise<Result<T>> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal })
        if (!response.ok) {
            return { ok: false, reason: `the service responded ${response.status}` }
        }
        const body = (await response.json()) as T
        return { ok: true, data: body }
    } catch (error) {
        return { ok: false, reason: describe(error) }
    } finally {
        clearTimeout(timer)
    }
}

/**
 * POST a JSON body to a backend door — the shape the identity service's `internal/sessions/*`
 * machine doors take. Same never-throws contract as `getJson`; a refused request additionally
 * lifts the flat `{code, message}` body the backend's business-code filter stamps
 * (`REQUEST_INVALID`, `SESSION_INVALID`, ...) onto the result, so a caller can tell a typed
 * refusal from an outage without parsing the status.
 */
export const postJson = async <T>(url: string, body: unknown): Promise<Result<T>> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
            signal: controller.signal,
        })
        const parsed = (await response.json().catch(() => null)) as RefusalBody | T | null
        if (!response.ok) {
            const refused = parsed as RefusalBody | null
            return {
                ok: false,
                reason: typeof refused?.message === "string" ? refused.message : `the service responded ${response.status}`,
                code: typeof refused?.code === "string" ? refused.code : undefined,
            }
        }
        if (parsed === null) {
            return { ok: false, reason: "the service answered without a readable body" }
        }
        return { ok: true, data: parsed as T }
    } catch (error) {
        return { ok: false, reason: describe(error) }
    } finally {
        clearTimeout(timer)
    }
}

/** The two collection shapes the backend lane may serve: a bare JSON array, or an `{ items }` envelope. */
export type CollectionResponse<T> = ReadonlyArray<T> | { readonly items?: ReadonlyArray<T> };

/**
 * Normalize either collection shape to a plain array. A `readonly` array is structurally assignable to the
 * `{ items? }` envelope, so no `Array.isArray`/`in` narrowing can cleanly discriminate the union for the
 * compiler — the per-branch casts are the honest way to say "I checked which shape arrived".
 */
export const unwrapItems = <T>(body: CollectionResponse<T>): ReadonlyArray<T> =>
    Array.isArray(body) ? (body as ReadonlyArray<T>) : ((body as { readonly items?: ReadonlyArray<T> }).items ?? [])
