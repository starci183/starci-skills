import type { Result } from "./outcome"

/** How long a read waits before the caller falls back to its empty state. */
const REQUEST_TIMEOUT_MS = 2500

/**
 * The one place raw `fetch` is allowed in the landing app. The teaser catalogue is static copy, so
 * no page reads a service today; the first read that does goes through this call and answers in
 * `Result`, never by throwing.
 */
export const getJson = async <T>(url: string): Promise<Result<T>> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal })
        if (!response.ok) return { ok: false, reason: `the service responded ${response.status}` }
        return { ok: true, data: (await response.json()) as T }
    } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : "the request failed" }
    } finally {
        clearTimeout(timer)
    }
}
