import "server-only"
import { collectionSlot, type GateNoticeProps, type LineItemRow, type Slot, type SlotLabels } from "@ecommerce/ui"
import { ORDER_API_URL } from "../config"
import { SHOP_ROUTES } from "../routes"
import { readCart, type CartRead } from "../services"

/** A page's translator: a key under its namespace, with optional values, answered as copy. */
type Translate = (key: string, values?: Record<string, string | number>) => string

/** The copy and lines slot the cart and checkout pages share about the read behind them. */
type CartPageCopy = {
    readonly title: string
    readonly description: string
    /** The sign-in gate, or `null` when the read was not refused. */
    readonly gate: GateNoticeProps | null
    /** What the lines slot says when it is empty and when the service was unreachable. */
    readonly slotLabels: SlotLabels
    /** The read's lines as one settled slot. */
    readonly linesSlot: Slot<ReadonlyArray<LineItemRow>>
}

/**
 * The words both cart-backed pages say about their read: the heading, the gate for a visitor with no session
 * (whose sign-in link keeps the reader's locale), the empty words, and the unreachable words that name the order
 * service's address so a failure is diagnosable.
 */
export const cartPageCopy = (t: Translate, locale: string, read: CartRead): CartPageCopy => ({
    title: t("title"),
    description: t("description"),
    gate:
        read.outcome.kind === "refused"
            ? {
                  title: t("signedOut.title"),
                  description: t("signedOut.description"),
                  actionLabel: t("accountCta"),
                  actionHref: `/${locale}${SHOP_ROUTES.account}`,
              }
            : null,
    slotLabels: {
        emptyTitle: t("empty.title"),
        emptyDescription: t("empty.description"),
        errorTitle: t("unreachable.title"),
        errorDescription: read.outcome.kind === "ok" ? "" : t("unreachable.description", { url: ORDER_API_URL }),
    },
    linesSlot: collectionSlot(read.outcome.kind === "ok" ? read.summary.rows : null),
})

/** The number formatter of a page: a minor-unit-free amount in a currency, as display text. */
type CurrencyFormatter = {
    readonly number: (amount: number, options: { readonly style: "currency"; readonly currency: string }) => string
}

/** The page's cart read, with its quantity and price words settled in the reader's language (prices in US dollars). */
export const readPageCart = (sessionToken: string | null, t: Translate, format: CurrencyFormatter): Promise<CartRead> =>
    readCart(sessionToken, {
        quantity: (count) => t("lineQuantity", { count }),
        price: (minorUnits) => format.number(minorUnits / 100, { style: "currency", currency: "USD" }),
    })
