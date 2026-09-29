/**
 * The only reader of `process.env` in this app.
 *
 * The value is read when it is asked for, not when the file loads, so importing this module never
 * fails a build or a spec that does not need the network. A missing value stops the caller with a
 * named error: there is no localhost fallback that would let a misconfigured deployment talk to
 * the wrong backend.
 *
 * `NEXT_PUBLIC_*` names are written out in full because Next.js replaces them at build time only
 * when the whole `process.env.NAME` expression is present in the source.
 */

const required = (name: string, value: string | undefined): string => {
    if (value === undefined || value === "") throw new Error(`${name} is not set`)
    return value
}

/** The backend's one GraphQL endpoint; throws when `NEXT_PUBLIC_API_GRAPHQL_URL` is not set. */
export const apiGraphqlUrl = (): string => required("NEXT_PUBLIC_API_GRAPHQL_URL", process.env.NEXT_PUBLIC_API_GRAPHQL_URL)
