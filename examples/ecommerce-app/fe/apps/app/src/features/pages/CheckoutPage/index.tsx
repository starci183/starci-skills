import { getFormatter, getLocale, getTranslations } from "next-intl/server"
import type { Outcome } from "@ecommerce/api"
import { checkoutAttemptKey } from "../../../modules/checkout"
import { cartPageCopy, readPageCart } from "../../../modules/cartcopy"
import { SHOP_ROUTES } from "../../../modules/routes"
import type { CartView } from "../../../modules/services"
import { readSessionToken } from "../../../modules/session"
import { CheckoutPageBase } from "./component"
import type { CheckoutPageState } from "./component"

/** The screen situation a checkout read settles: gate, refusal, empty cart, or the summary. */
const checkoutPageStateOf = (outcome: Outcome<CartView>): CheckoutPageState =>
    outcome.kind === "refused" ? "signedOut" : "checkout"

/**
 * The connected checkout page. The cart read happens here on the server - the same session-guarded
 * `cart` query the cart page uses - and the rendered confirmation carries a fresh idempotency key minted
 * at this render, so pressing confirm again replays rather than double-orders. Every sentence, every
 * amount and both prefixed hrefs resolve before the pure twin sees a prop.
 */
export const CheckoutPage = async () => {
    const sessionToken = await readSessionToken()
    const t = await getTranslations("shop.checkout")
    const locale = await getLocale()
    const format = await getFormatter()
    const read = await readPageCart(sessionToken, t, format)
    const { outcome, summary } = read
    return (
        <CheckoutPageBase
            state={checkoutPageStateOf(outcome)}
            props={{
                ...cartPageCopy(t, locale, read),
                summaryTitle: t("summaryTitle"),
                orderTotal: summary.total,
                attemptKey: sessionToken ? checkoutAttemptKey() : "",
                productNames: summary.productNames,
                confirmLabel: t("confirmCta"),
                confirmingLabel: t("confirmingCta"),
                confirmedTitle: t("confirmed.title"),
                confirmedDetail: t.raw("confirmed.detail"),
                replayedNote: t("confirmed.replayedNote"),
                receiptLabel: t("confirmed.receipt.cta"),
                receiptPendingLabel: t("confirmed.receipt.pending"),
                receiptNotReady: t("confirmed.receipt.notReady"),
                receiptRefused: t("confirmed.receipt.refused"),
                refusedCartEmpty: t("refused.cartEmpty"),
                refusedStock: t.raw("refused.insufficientStock"),
                refusedUnknownProduct: t.raw("refused.unknownProduct"),
                refusedSession: t("refused.sessionInvalid"),
                refusedGeneric: t.raw("refused.generic"),
                browseCta: t("browseCta"),
                accountCta: t("accountCta"),
                browseHref: `/${locale}${SHOP_ROUTES.browse}`,
                accountHref: `/${locale}${SHOP_ROUTES.account}`,
            }}
        />
    )
}
