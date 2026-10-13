/**
 * The only reader of `process.env` in this app. A value is read when it is asked for, not when the file loads, and a
 * missing value stops the caller with a named error: there is no localhost fallback.
 */

const required = (name: string, value: string | undefined): string => {
    if (value === undefined || value === "") throw new Error(`${name} is not set`)
    return value
}

/** The public origin of the app, the base of every absolute metadata URL; throws when `NEXT_PUBLIC_SITE_URL` is not set. */
export const siteUrl = (): string => required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL)
