import { getLocale, getTranslations } from "next-intl/server"
import { fetchCart } from "../../../modules/api/cart"
import { ORDER_API_URL } from "../../../modules/config"
import { formatPrice } from "../../../modules/money"
import { ROUTES } from "../../../modules/routes"
import { readSessionToken } from "../../../modules/session"
import { CartPageBase } from "./component"
import type { CartLineRow, CartPageState } from "./component"
import type { CartView } from "../../../modules/api/cart"
import type { GraphqlResult } from "../../../modules/api/graphql"

/** Props for the connected cart page: the route mounts it empty and it reads its own world. */
export type CartPageProps = Record<never, never>

/** The screen situation a cart read settles: gate, refusal, genuine empty, or the lines. */
const cartPageStateOf = (result: GraphqlResult<CartView>): CartPageState => {
    if (!result.ok) {
        return result.code === "SESSION_INVALID" ? "signedOut" : "failed"
    }
    return result.data.items.length === 0 ? "empty" : "ready"
}

/**
 * The connected cart page. The cart read happens here on the server - the order service's
 * session-guarded `cart` query - and each line is joined with the catalog snapshot for its name
 * and price before the pure twin sees a prop. A line the catalog no longer knows renders under its
 * product id, honestly unnamed.
 */
export const CartPage = async (props: CartPageProps) => {
    void props
    const [t, locale, sessionToken] = await Promise.all([
        getTranslations("shop.cart"),
        getLocale(),
        readSessionToken(),
    ])
    const result = sessionToken
        ? await fetchCart(sessionToken)
        : { ok: false as const, reason: "no signed-in session", code: "SESSION_INVALID" }
    const catalog = result.ok ? result.data.catalog : []
    const lines: ReadonlyArray<CartLineRow> = result.ok
        ? result.data.items.map((item) => {
            const product = catalog.find((entry) => entry.id === item.productId)
            return {
                productId: item.productId,
                name: product?.name ?? item.productId,
                quantityLabel: t("lineQuantity", { count: item.quantity }),
                lineTotal: product ? formatPrice(product.priceMinorUnits * item.quantity, "USD") : "—",
            }
        })
        : []
    const total = result.ok
        ? result.data.items.reduce((sum, item) => {
            const product = catalog.find((entry) => entry.id === item.productId)
            return sum + (product ? product.priceMinorUnits * item.quantity : 0)
        }, 0)
        : 0
    return (
        <CartPageBase
            state={cartPageStateOf(result)}
            props={{
                title: t("title"),
                description: t("description"),
                linesTitle: t("linesTitle"),
                cartTotal: formatPrice(total, "USD"),
                lines,
                clearLabel: t("clearLabel"),
                clearingLabel: t("clearingLabel"),
                clearRefused: t("clearRefused"),
                checkoutCta: t("checkoutCta"),
                checkoutHref: `/${locale}${ROUTES.checkout}`,
                emptyTitle: t("empty.title"),
                emptyDescription: t("empty.description"),
                backToBrowse: t("backToBrowse"),
                browseHref: `/${locale}${ROUTES.browse}`,
                accountCta: t("accountCta"),
                accountHref: `/${locale}${ROUTES.account}`,
                signedOutTitle: t("signedOut.title"),
                signedOutDescription: t("signedOut.description"),
                unreachableTitle: t("unreachable.title"),
                unreachableDescription: result.ok
                    ? ""
                    : t("unreachable.description", { url: ORDER_API_URL, reason: result.reason }),
            }}
            on={{}}
        />
    )
}
