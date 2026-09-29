/** Configuration of the shape-slot app, read once from the environment; a missing value fails at load, there is no fallback. */
export type AppConfig = {
    /** Origin-relative or absolute base of the sales API. */
    readonly apiBaseUrl: string
    /** Milliseconds after which a request is abandoned. */
    readonly requestTimeoutMs: number
}

/** The one place `process.env` is read. `NEXT_PUBLIC_*` names are written out in full so the bundler can inline them. */
const readConfig = (): AppConfig => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    if (apiBaseUrl === undefined || apiBaseUrl === "") {
        throw new Error("NEXT_PUBLIC_API_BASE_URL is required")
    }
    return { apiBaseUrl, requestTimeoutMs: 10_000 }
}

export const config: AppConfig = readConfig()
