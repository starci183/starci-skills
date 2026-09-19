/**
 * The shop's internal routes, owned in one place so a link never spells the same path twice -
 * internal navigation reads a named route, never a literal written at the call site.
 */
export const ROUTES: Readonly<Record<"browse" | "cart" | "checkout" | "account", string>> = {
    browse: "/browse",
    cart: "/cart",
    checkout: "/checkout",
    account: "/account",
}
