import { getFormatter, getTranslations } from "next-intl/server"
import type { Outcome } from "@ecommerce/api"
import { collectionSlot } from "@ecommerce/ui"
import { orderApiUrl } from "../../../modules/config"
import { fetchProducts, type Product } from "../../../modules/services"
import { readSessionToken } from "../../../modules/session"
import { BrowsePageBase } from "./component"
import type { BrowsePageState } from "./component"

/**
 * The screen situation a catalogue read settles. The catalog rides the session-guarded `cart`
 * query, so a dead or absent token is the signed-out gate, a transport failure is the refusal, and
 * a reachable service with zero rows is the genuine empty.
 */
const browsePageStateOf = (outcome: Outcome<ReadonlyArray<Product>>): BrowsePageState =>
    outcome.kind === "refused" ? "signedOut" : "browse"

/**
 * The connected browse page. The catalogue read happens here on the server (the order service's
 * data, not build-time content), and every sentence - including the refusal with the service URL
 * interpolated - and every price in the reader's language is resolved before the pure twin sees a prop.
 */
export const BrowsePage = async () => {
    const [t, format, sessionToken] = await Promise.all([
        getTranslations("shop.browse"),
        getFormatter(),
        readSessionToken(),
    ])
    const outcome = await fetchProducts(sessionToken)
    return (
        <BrowsePageBase
            state={browsePageStateOf(outcome)}
            props={{
                title: t("title"),
                description:
                    outcome.kind === "ok" && outcome.data.length > 0
                        ? t("descriptionCount", { count: outcome.data.length })
                        : t("description"),
                productsSlot: collectionSlot(
                    outcome.kind === "ok"
                        ? outcome.data.map((product) => ({
                              id: product.id,
                              name: product.name,
                              price: format.number(product.priceCents / 100, {
                                  style: "currency",
                                  currency: product.currency,
                              }),
                              stock: product.stock,
                              imageUrl: product.imageUrl,
                          }))
                        : null,
                ),
                stockLabel: t.raw("stockLabel"),
                addToCart: t("addToCart"),
                addingToCart: t("addingToCart"),
                inCartLabel: t.raw("inCartLabel"),
                addRefused: t("addRefused"),
                signedOutTitle: t("signedOut.title"),
                signedOutDescription: t("signedOut.description"),
                unreachableTitle: t("unreachable.title"),
                unreachableDescription:
                    outcome.kind === "ok" ? "" : t("unreachable.description", { url: orderApiUrl() }),
                emptyTitle: t("empty.title"),
                emptyDescription: t("empty.description"),
            }}
        />
    )
}
