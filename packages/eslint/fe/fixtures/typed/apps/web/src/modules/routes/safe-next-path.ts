const INVALID_PATH_CHARACTER = /[\\u0000-\u001F\u007F]/u

/** Fixture: a pure same-origin validation of the callback's `next`. */
export const safeNextPath = (candidate: string | null, origin: string): string => {
    if (candidate === null) return "/"
    try {
        const destination = new URL(candidate, origin)
        const decoded = decodeURIComponent(candidate)
        if (destination.origin !== origin || INVALID_PATH_CHARACTER.test(decoded)) return "/"
        return `${destination.pathname}${destination.search}`
    } catch {
        return "/"
    }
}
