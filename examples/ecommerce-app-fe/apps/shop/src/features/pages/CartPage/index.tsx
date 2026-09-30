import { getLocale, getTranslations } from "next-intl/server"
import { collectionSlot } from "@ecommerce/shared"
import type { GraphqlResult } from "../../../modules/api"
import { ORDER_API_URL } from "../../../modules/config"
import { ROUTES } from "../../../modules/routes"
import { readCart, type CartView } from "../../../modules/services"
import { readSessionToken } from "../../../modules/session"
import { CartPageBase } from "./component"
import type { CartPageState } from "./component"

/** Props for the connected cart page: the route mounts it empty and it reads its own world. */
type CartPageProps = Record<never, never>

/** The screen situation a cart read settles: gate, refusal, genuine empty, or the lines. */
const cartPageStateOf = (result: GraphqlResult<CartView>): CartPageState => {
    return !result.ok && result.code === "SESSION_INVALID" ? "signedOut" : "cart"
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
    const { result, summary } = await readCart(sessionToken, (count) => t("lineQuantity", { count }))
    return (
        <CartPageBase
            state={cartPageStateOf(result)}
            props={{
                title: t("title"),
                description: t("description"),
                linesTitle: t("linesTitle"),
                cartTotal: summary.total,
                linesSlot: collectionSlot(result.ok ? summary.rows : null),
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
