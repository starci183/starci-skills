import { getTranslations } from "next-intl/server"
import { collectionSlot } from "@ecommerce/shared"
import type { GraphqlResult } from "../../../modules/api"
import { ORDER_API_URL } from "../../../modules/config"
import { fetchProducts, type Product } from "../../../modules/services"
import { readSessionToken } from "../../../modules/session"
import { BrowsePageBase } from "./component"
import type { BrowsePageState } from "./component"

/** Props for the connected browse page: the route mounts it empty and it reads its own world. */
type BrowsePageProps = Record<never, never>

/**
 * The screen situation a catalogue read settles. The catalog rides the session-guarded `cart`
 * query, so a dead or absent token is the signed-out gate, a transport failure is the refusal, and
 * a reachable service with zero rows is the genuine empty.
 */
const browsePageStateOf = (result: GraphqlResult<ReadonlyArray<Product>>): BrowsePageState => {
    return !result.ok && result.code === "SESSION_INVALID" ? "signedOut" : "browse"
}

/**
 * The connected browse page. The catalogue read happens here on the server (the order service's
 * data, not build-time content), and every sentence - including the refusal with the service URL
 * and reason interpolated - is resolved before the pure twin sees a prop.
 */
export const BrowsePage = async (props: BrowsePageProps) => {
    void props
    const [t, sessionToken] = await Promise.all([getTranslations("shop.browse"), readSessionToken()])
    const result = await fetchProducts(sessionToken)
    return (
        <BrowsePageBase
            state={browsePageStateOf(result)}
            props={{
                title: t("title"),
                description: result.ok && result.data.length > 0
                    ? t("descriptionCount", { count: result.data.length })
                    : t("description"),
                productsSlot: collectionSlot(result.ok ? result.data : null),
                stockLabel: t.raw("stockLabel"),
                addToCart: t("addToCart"),
                addingToCart: t("addingToCart"),
                inCartLabel: t.raw("inCartLabel"),
                addRefused: t("addRefused"),
                signedOutTitle: t("signedOut.title"),
                signedOutDescription: t("signedOut.description"),
                unreachableTitle: t("unreachable.title"),
                unreachableDescription: result.ok
                    ? ""
                    : t("unreachable.description", { url: ORDER_API_URL, reason: result.reason }),
                emptyTitle: t("empty.title"),
                emptyDescription: t("empty.description"),
            }}
            on={{}}
        />
    )
}
