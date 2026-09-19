import { getLocale, getTranslations } from "next-intl/server"
import { fetchCart } from "../../../modules/api/cart"
import { checkoutAttemptKey } from "../../../modules/checkout"
import { ORDER_API_URL } from "../../../modules/config"
import { formatPrice } from "../../../modules/money"
import { ROUTES } from "../../../modules/routes"
import { readSessionToken } from "../../../modules/session"
import { CheckoutPageBase } from "./component"
import type { CheckoutLineRow, CheckoutPageState } from "./component"
import type { CartView } from "../../../modules/api/cart"
import type { GraphqlResult } from "../../../modules/api/graphql"

/** Props for the connected checkout page: the route mounts it empty and it reads its own world. */
export type CheckoutPageProps = Record<never, never>

/** The screen situation a checkout read settles: gate, refusal, empty cart, or the summary. */
const checkoutPageStateOf = (result: GraphqlResult<CartView>): CheckoutPageState => {
    if (!result.ok) {
        return result.code === "SESSION_INVALID" ? "signedOut" : "failed"
    }
    return result.data.items.length === 0 ? "empty" : "ready"
}

/**
 * The connected checkout page. The cart read happens here on the server - the same session-guarded
 * `cart` query the cart page uses - and the rendered confirmation's idempotency key is digested
 * from the person and the lines at this render, so pressing confirm again replays rather than
 * double-orders. Every sentence and both prefixed hrefs resolve before the pure twin sees a prop.
 */
export const CheckoutPage = async (props: CheckoutPageProps) => {
    void props
    const [t, locale, sessionToken] = await Promise.all([
        getTranslations("shop.checkout"),
        getLocale(),
        readSessionToken(),
    ])
    const result = sessionToken
        ? await fetchCart(sessionToken)
        : { ok: false as const, reason: "no signed-in session", code: "SESSION_INVALID" }
    const items = result.ok ? result.data.items : []
    const catalog = result.ok ? result.data.catalog : []
    const productNames: Record<string, string> = {}
    for (const product of catalog) {
        productNames[product.id] = product.name
    }
    const lines: ReadonlyArray<CheckoutLineRow> = items.map((item) => {
        const product = catalog.find((entry) => entry.id === item.productId)
        return {
            productId: item.productId,
            name: product?.name ?? item.productId,
            quantityLabel: t("lineQuantity", { count: item.quantity }),
            lineTotal: product ? formatPrice(product.priceMinorUnits * item.quantity, "USD") : "—",
        }
    })
    const total = items.reduce((sum, item) => {
        const product = catalog.find((entry) => entry.id === item.productId)
        return sum + (product ? product.priceMinorUnits * item.quantity : 0)
    }, 0)
    const attemptKey = sessionToken ? checkoutAttemptKey() : ""
    return (
        <CheckoutPageBase
            state={checkoutPageStateOf(result)}
            props={{
                title: t("title"),
                description: t("description"),
                summaryTitle: t("summaryTitle"),
                orderTotal: formatPrice(total, "USD"),
                lines,
                attemptKey,
                productNames,
                confirmLabel: t("confirmCta"),
                confirmingLabel: t("confirmingCta"),
                confirmedTitle: t("confirmed.title"),
                confirmedDetail: t.raw("confirmed.detail"),
                replayedNote: t("confirmed.replayedNote"),
                refusedCartEmpty: t("refused.cartEmpty"),
                refusedStock: t.raw("refused.insufficientStock"),
                refusedUnknownProduct: t.raw("refused.unknownProduct"),
                refusedSession: t("refused.sessionInvalid"),
                refusedGeneric: t.raw("refused.generic"),
                emptyTitle: t("empty.title"),
                emptyDescription: t("empty.description"),
                signedOutTitle: t("signedOut.title"),
                signedOutDescription: t("signedOut.description"),
                unreachableTitle: t("unreachable.title"),
                unreachableDescription: result.ok
                    ? ""
                    : t("unreachable.description", { url: ORDER_API_URL, reason: result.reason }),
                browseCta: t("browseCta"),
                accountCta: t("accountCta"),
                browseHref: `/${locale}${ROUTES.browse}`,
                accountHref: `/${locale}${ROUTES.account}`,
            }}
            on={{}}
        />
    )
}
