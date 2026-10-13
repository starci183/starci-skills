"use client"

import { useTranslations } from "next-intl"
import { useCartPage, useConfirmOrder, useDownloadReceipt } from "../../../hooks/cart"
import { CheckoutSummaryBase } from "./component"

/**
 * The connected checkout. The cart is the same session-guarded `cart` query the cart page reads; the confirm control
 * mints its idempotency key once per mounted checkout, so pressing confirm again replays rather than double-orders, and a
 * confirmed order offers its receipt. Every sentence, every amount and both prefixed hrefs resolve before the pure twin
 * sees a prop.
 */
export const CheckoutSummary = () => {
    const t = useTranslations("shop.checkout")
    const cart = useCartPage("shop.checkout")
    const confirm = useConfirmOrder(cart.summary.productNames)
    const receipt = useDownloadReceipt(confirm.props.orderId)
    return (
        <CheckoutSummaryBase
            state={cart.state === "ready" ? "checkout" : cart.state}
            props={{
                ...cart.copy,
                summaryTitle: t("summaryTitle"),
                orderTotal: cart.summary.total,
                browseCta: t("browseCta"),
                browseHref: cart.hrefs.browse,
                confirm: {
                    props: {
                        confirmLabel: t("confirmCta"),
                        confirmingLabel: t("confirmingCta"),
                        pending: confirm.props.pending,
                        refusal: confirm.props.refusal,
                        confirmed: confirm.props.confirmed
                            ? {
                                  ...confirm.props.confirmed,
                                  title: t("confirmed.title"),
                                  receiptLabel: t("confirmed.receipt.cta"),
                                  receiptPendingLabel: t("confirmed.receipt.pending"),
                                  receiptPending: receipt.props.pending,
                                  receiptFailure: receipt.props.failure,
                                  accountCta: t("accountCta"),
                                  accountHref: cart.hrefs.account,
                              }
                            : null,
                    },
                    on: { onPress: confirm.on.onPress, onReceipt: receipt.on.onPress },
                },
            }}
        />
    )
}
