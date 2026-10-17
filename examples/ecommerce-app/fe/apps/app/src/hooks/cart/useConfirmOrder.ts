import { useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import type { GraphQLFailure } from "@ecommerce/api"
import { useGraphQLWithToast } from "@/modules/toast"
import { useMutatePlaceOrderSwr } from "../swr"

/**
 * Owns the confirmation attempts of one mounted checkout and resolves the last answer into words: the confirmed order's
 * line (its total formatted in the reader's language) and replay note, or the line naming what the order service refused
 * and why (the stable code picks the copy, the refusal's parameters fill it). The idempotency key is minted once per
 * mounted checkout: the service scopes replay by (person, key), so a repeat press re-sends the same key and is answered as
 * a replay, while a fresh visit mints a new key and is a genuinely new order. The key is deliberately not a digest of the
 * cart: two purchases can hold identical lines.
 */
export const useConfirmOrder = (productNames: Readonly<Record<string, string>>) => {
    const t = useTranslations("shop.checkout")
    const format = useFormatter()
    const runGraphQL = useGraphQLWithToast()
    const place = useMutatePlaceOrderSwr()
    const [attemptKey] = useState(() => `checkout-${crypto.randomUUID()}`)
    const onPress = () => {
        void runGraphQL(() => place.trigger({ idempotencyKey: attemptKey }), { showSuccessToast: false })
    }

    /** The line that names what the service refused and why. */
    const refusalLine = (failure: GraphQLFailure): string => {
        if (failure.kind === "unauthenticated") return t("refused.sessionInvalid")
        const productId = String(failure.params.productId ?? "")
        if (failure.error === "ORDER_CART_EMPTY") return t("refused.cartEmpty")
        if (failure.error === "ORDER_INSUFFICIENT_STOCK")
            return t("refused.insufficientStock", {
                product: productNames[productId] ?? productId,
                requested: String(failure.params.requested ?? ""),
                available: String(failure.params.available ?? ""),
            })
        if (failure.error === "ORDER_UNKNOWN_PRODUCT") return t("refused.unknownProduct", { productId })
        return t("refused.generic", { code: failure.error })
    }

    const outcome = place.data
    const order = outcome?.success ? outcome.data : null
    return {
        props: {
            orderId: order?.orderId ?? "",
            pending: place.isMutating,
            refusal: outcome !== undefined && !outcome.success ? refusalLine(outcome) : null,
            confirmed: order
                ? {
                      line: t("confirmed.detail", {
                          orderId: order.orderId,
                          status: order.status,
                          total: format.number(order.totalMinorUnits / 100, {
                              style: "currency",
                              currency: order.currency,
                          }),
                      }),
                      replayedNote: order.replayed ? t("confirmed.replayedNote") : null,
                  }
                : null,
        },
        on: { onPress },
    }
}
