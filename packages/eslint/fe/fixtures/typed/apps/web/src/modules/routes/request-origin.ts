import { siteOrigin } from "../config"

/** Fixture: the headers of a request. */
export interface OriginSource {
    readonly headers: { get(name: string): string | null }
}

/** Fixture: a pure public-origin computation that reads the environment through its owner. */
export const requestOrigin = (request: OriginSource): string => {
    const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    return host ? `https://${host}` : (siteOrigin() ?? "http://localhost")
}
