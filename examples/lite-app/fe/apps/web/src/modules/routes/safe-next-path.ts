const INVALID_PATH_CHARACTER = /[\\\u0000-\u001F\u007F]/u

const isSingleSlashPath = (value: string): boolean => value.startsWith("/") && !value.startsWith("//")

/** Normalizes a same-origin callback destination or falls back to the app root. */
export const safeNextPath = (candidate: string | null, origin: string): string => {
    if (candidate === null) return "/"
    let destination: URL
    let decoded: string
    try {
        destination = new URL(candidate, origin)
        decoded = decodeURIComponent(candidate)
    } catch {
        return "/"
    }
    if (
        destination.origin !== origin ||
        !isSingleSlashPath(destination.pathname) ||
        !isSingleSlashPath(candidate) ||
        !isSingleSlashPath(decoded) ||
        INVALID_PATH_CHARACTER.test(candidate) ||
        INVALID_PATH_CHARACTER.test(decoded)
    ) {
        return "/"
    }
    return `${destination.pathname}${destination.search}${destination.hash}`
}
