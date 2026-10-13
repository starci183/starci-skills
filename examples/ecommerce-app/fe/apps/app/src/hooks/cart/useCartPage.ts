import { useFormatter, useLocale, useTranslations } from "next-intl"
import { collectionSlot } from "@ecommerce/ui"
import type { GateNoticeProps, LineItemRow, Slot, SlotLabels } from "@ecommerce/ui"
import { orderApiUrl } from "@/modules/config"
import { SHOP_ROUTES } from "@/modules/routes"
import { summarizeCart } from "./cart.shared"
import type { CartSummary } from "./cart.shared"
import { useCartView } from "./useCartView"

/** The copy, the lines slot, the summary and the links the cart and checkout pages share about the cart read behind them. */
export type CartPageRead = {
    /** No live session (the page draws its gate), or the cart surface (its lines slot loading, settled or refused). */
    readonly state: "signedOut" | "ready"
    readonly copy: {
        readonly title: string
        readonly description: string
        readonly gate: GateNoticeProps | null
        readonly slotLabels: SlotLabels
        readonly linesSlot: Slot<ReadonlyArray<LineItemRow>>
    }
    readonly summary: CartSummary
    readonly hrefs: { readonly browse: string; readonly checkout: string; readonly account: string }
}

/**
 * The words both cart-backed pages say about their read, in the namespace of the page: the heading, the gate for a
 * visitor with no session (whose sign-in link keeps the reader's locale), the empty words, the unreachable words that
 * name the order service's address, and the lines with their prices in US dollars in the reader's language.
 */
export const useCartPage = (namespace: "shop.cart" | "shop.checkout"): CartPageRead => {
    const t = useTranslations(namespace)
    const tLoading = useTranslations("shop.loading")
    const locale = useLocale()
    const format = useFormatter()
    const read = useCartView()
    const labels = {
        quantity: (count: number) => t("lineQuantity", { count }),
        price: (minorUnits: number) => format.number(minorUnits / 100, { style: "currency", currency: "USD" }),
    }
    const summary =
        read.status === "ready"
            ? summarizeCart(read.view, labels)
            : { rows: [], total: labels.price(0), productNames: {} }
    const accountHref = `/${locale}${SHOP_ROUTES.account}`
    return {
        state: read.status === "signedOut" ? "signedOut" : "ready",
        copy: {
            title: t("title"),
            description: t("description"),
            gate:
                read.status === "signedOut"
                    ? {
                          title: t("signedOut.title"),
                          description: t("signedOut.description"),
                          actionLabel: t("accountCta"),
                          actionHref: accountHref,
                      }
                    : null,
            slotLabels: {
                loadingLabel: tLoading("message"),
                emptyTitle: t("empty.title"),
                emptyDescription: t("empty.description"),
                errorTitle: t("unreachable.title"),
                errorDescription: read.status === "error" ? t("unreachable.description", { url: orderApiUrl() }) : "",
            },
            linesSlot:
                read.status === "loading" || read.status === "signedOut"
                    ? { status: "loading" }
                    : collectionSlot(read.status === "ready" ? summary.rows : null),
        },
        summary,
        hrefs: {
            browse: `/${locale}${SHOP_ROUTES.browse}`,
            checkout: `/${locale}${SHOP_ROUTES.checkout}`,
            account: accountHref,
        },
    }
}
