import { ConfigError, ConfigErrorCode } from "@modules/platform/config"

const ORIGINS_KEY = "HTTP_SECURITY_ALLOWED_ORIGINS"
const PROXY_KEY = "HTTP_SECURITY_TRUST_PROXY"

/** Allows HTTPS origins and local HTTP development origins, never a wildcard or a URL path. */
export const allowedOriginsOf = (value: string): ReadonlyArray<string> => {
    const origins = value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    if (origins.length === 0) throw new ConfigError({ code: ConfigErrorCode.KeyInvalid, params: { key: ORIGINS_KEY } })
    for (const origin of origins) {
        if (origin.includes("*") || !URL.canParse(origin))
            throw new ConfigError({ code: ConfigErrorCode.KeyInvalid, params: { key: ORIGINS_KEY } })
        const url = new URL(origin)
        const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        if (url.origin !== origin || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
            throw new ConfigError({ code: ConfigErrorCode.KeyInvalid, params: { key: ORIGINS_KEY } })
        }
    }
    return origins
}

/** A direct host listener trusts only an explicitly configured integer hop count. */
export const trustProxyOf = (hops: number): number => {
    if (!Number.isInteger(hops) || hops < 0 || hops > 10)
        throw new ConfigError({ code: ConfigErrorCode.KeyInvalid, params: { key: PROXY_KEY } })
    return hops
}
