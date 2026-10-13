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

/** The back end's GraphQL endpoint, the terminal link of modules/api; throws when `NEXT_PUBLIC_GRAPHQL_URL` is not set. */
export const graphqlUrl = (): string => required("NEXT_PUBLIC_GRAPHQL_URL", process.env.NEXT_PUBLIC_GRAPHQL_URL)

/** The back end's REST base (uploads, presigned URLs, auth endpoints), the axios instance of modules/api; throws when `NEXT_PUBLIC_REST_URL` is not set. */
export const restUrl = (): string => required("NEXT_PUBLIC_REST_URL", process.env.NEXT_PUBLIC_REST_URL)
