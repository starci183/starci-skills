/**
 * The back-end services the shop's browser calls, and nothing else: the only reader of the shop's `NEXT_PUBLIC_*`
 * environment. The browser calls the identity and order GraphQL APIs directly (owner ruling 2026-10-13), so each base URL is
 * a public value inlined at build time - the serve script at the app root fills it from the product's resolved projection
 * (`.starcistacks/dev/infra/metadata.json`) when it starts the app, and a deployment passes it as a build argument. A
 * missing value fails the first call that needs it, naming the variable; there is no localhost fallback.
 */

/** The value of one public variable, or a failure naming it. */
const required = (name: string, value: string | undefined): string => {
    if (value === undefined || value === "")
        throw new Error(`${name} is not set; start the shop with scripts/serve.mjs or set it.`)
    return value
}

/** Identity service: registration, sign-in, the session and the shopper's account. */
export const identityApiUrl = (): string =>
    required("NEXT_PUBLIC_IDENTITY_API_URL", process.env.NEXT_PUBLIC_IDENTITY_API_URL)

/** Order service: the catalogue, the cart, the orders and their receipts. */
export const orderApiUrl = (): string => required("NEXT_PUBLIC_ORDER_API_URL", process.env.NEXT_PUBLIC_ORDER_API_URL)

/** The identity service's GraphQL endpoint. */
export const identityGraphqlUrl = (): string => `${identityApiUrl()}/graphql`

/** The order service's GraphQL endpoint. */
export const orderGraphqlUrl = (): string => `${orderApiUrl()}/graphql`
