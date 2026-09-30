import { getFormatter, getLocale, getTranslations } from "next-intl/server"
import type { Outcome } from "@ecommerce/api"
import { cartPageCopy, readPageCart } from "../../../modules/cartcopy"
import { SHOP_ROUTES } from "../../../modules/routes"
import type { CartView } from "../../../modules/services"
import { readSessionToken } from "../../../modules/session"
import { CartPageBase } from "./component"
import type { CartPageState } from "./component"

/** Props for the connected cart page: the route mounts it empty and it reads its own world. */
type CartPageProps = Record<never, never>

/** The screen situation a cart read settles: gate, refusal, genuine empty, or the lines. */
const cartPageStateOf = (outcome: Outcome<CartView>): CartPageState =>
    outcome.kind === "refused" ? "signedOut" : "cart"

/**
 * The connected cart page. The cart read happens here on the server - the order service's
 * session-guarded `cart` query - and each line is joined with the catalog snapshot for its name
 * and price before the pure twin sees a prop. A line the catalog no longer knows renders under its
 * product id, honestly unnamed.
 */
export const CartPage = async (props: CartPageProps) => {
    void props
    const [t, locale, format, sessionToken] = await Promise.all([
        getTranslations("shop.cart"),
        getLocale(),
        getFormatter(),
        readSessionToken(),
    ])
    const read = await readPageCart(sessionToken, t, format)
    const { outcome, summary } = read
    return (
        <CartPageBase
            state={cartPageStateOf(outcome)}
            props={{
                ...cartPageCopy(t, locale, read),
                linesTitle: t("linesTitle"),
                cartTotal: summary.total,
                clearLabel: t("clearLabel"),
                clearingLabel: t("clearingLabel"),
                clearRefused: t("clearRefused"),
                checkoutCta: t("checkoutCta"),
                checkoutHref: `/${locale}${SHOP_ROUTES.checkout}`,
                backToBrowse: t("backToBrowse"),
                browseHref: `/${locale}${SHOP_ROUTES.browse}`,
            }}
            on={{}}
        />
    )
}
