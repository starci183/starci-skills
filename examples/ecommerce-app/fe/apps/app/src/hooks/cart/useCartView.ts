import type { QueryCartResponse } from "@/modules/api"
import { useSession } from "../session"
import { useQueryCartSwr } from "../swr"

/**
 * What the cart read settles to: still loading, no live session (the order service guards the cart and the catalogue),
 * unreachable or refused, or the cart with its catalogue snapshot.
 */
export type CartViewState =
    | { readonly status: "loading" }
    | { readonly status: "signedOut" }
    | { readonly status: "error" }
    | { readonly status: "ready"; readonly view: QueryCartResponse }

/** The signed-in person's cart and catalogue, settled for a page. */
export const useCartView = (): CartViewState => {
    const session = useSession()
    const cart = useQueryCartSwr()
    if (session.status === "unknown") return { status: "loading" }
    if (session.status === "signed-out") return { status: "signedOut" }
    if (cart.data === undefined) return cart.error === undefined ? { status: "loading" } : { status: "error" }
    if (!cart.data.success) return cart.data.kind === "unauthenticated" ? { status: "signedOut" } : { status: "error" }
    return { status: "ready", view: cart.data.data }
}
