"use client"

import { useTranslations } from "next-intl"
import { useCartPage, useClearCart } from "../../../hooks/cart"
import { CartLinesBase } from "./component"

/**
 * The connected cart of the cart page. The cart is the order service's session-guarded `cart` query, read in the browser through
 * the cart hook, and each line is joined with the catalogue snapshot for its name and price before the pure twin sees a
 * prop. A line the catalogue no longer knows renders under its product id, honestly unnamed.
 */
export const CartLines = () => {
    const t = useTranslations("shop.cart")
    const { state, copy, summary, hrefs } = useCartPage("shop.cart")
    const clear = useClearCart()
    return (
        <CartLinesBase
            state={state === "ready" ? "cart" : state}
            props={{
                ...copy,
                linesTitle: t("linesTitle"),
                cartTotal: summary.total,
                clearLabel: t("clearLabel"),
                clearingLabel: t("clearingLabel"),
                clearRefused: t("clearRefused"),
                checkoutCta: t("checkoutCta"),
                checkoutHref: hrefs.checkout,
                backToBrowse: t("backToBrowse"),
                browseHref: hrefs.browse,
                clearRefusedShown: clear.props.refused,
                clearPending: clear.props.pending,
            }}
            on={{ onClear: clear.on.onPress }}
        />
    )
}
