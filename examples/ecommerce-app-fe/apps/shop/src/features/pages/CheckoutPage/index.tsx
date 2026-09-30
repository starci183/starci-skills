import { getLocale, getTranslations } from "next-intl/server"
import { collectionSlot } from "@ecommerce/shared"
import type { GraphqlResult } from "../../../modules/api"
import { checkoutAttemptKey } from "../../../modules/checkout"
import { ORDER_API_URL } from "../../../modules/config"
import { ROUTES } from "../../../modules/routes"
import { readCart, type CartView } from "../../../modules/services"
import { readSessionToken } from "../../../modules/session"
import { CheckoutPageBase } from "./component"
import type { CheckoutPageState } from "./component"

/** Props for the connected checkout page: the route mounts it empty and it reads its own world. */
type CheckoutPageProps = Record<never, never>

/** The screen situation a checkout read settles: gate, refusal, empty cart, or the summary. */
const checkoutPageStateOf = (result: GraphqlResult<CartView>): CheckoutPageState => {
    return !result.ok && result.code === "SESSION_INVALID" ? "signedOut" : "checkout"
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
    const { result, summary } = await readCart(sessionToken, (count) => t("lineQuantity", { count }))
    const attemptKey = sessionToken ? checkoutAttemptKey() : ""
    return (
        <CheckoutPageBase
            state={checkoutPageStateOf(result)}
            props={{
                title: t("title"),
                description: t("description"),
                summaryTitle: t("summaryTitle"),
                orderTotal: summary.total,
                linesSlot: collectionSlot(result.ok ? summary.rows : null),
                attemptKey,
                productNames: summary.productNames,
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
