import { getTranslations } from "next-intl/server"
import { fetchProducts } from "../../../modules/api/catalog"
import { ORDER_API_URL } from "../../../modules/config"
import { readSessionToken } from "../../../modules/session"
import { BrowsePageBase } from "./component"
import type { BrowsePageState } from "./component"
import type { Product } from "../../../modules/api/catalog"
import type { GraphqlResult } from "../../../modules/api/graphql"

/** Props for the connected browse page: the route mounts it empty and it reads its own world. */
export type BrowsePageProps = Record<never, never>

/**
 * The screen situation a catalogue read settles. The catalog rides the session-guarded `cart`
 * query, so a dead or absent token is the signed-out gate, a transport failure is the refusal, and
 * a reachable service with zero rows is the genuine empty.
 */
const browsePageStateOf = (result: GraphqlResult<ReadonlyArray<Product>>): BrowsePageState => {
    if (!result.ok) {
        return result.code === "SESSION_INVALID" ? "signedOut" : "failed"
    }
    return result.data.length === 0 ? "empty" : "ready"
}

/**
 * The connected browse page. The catalogue read happens here on the server (the order service's
 * data, not build-time content), and every sentence - including the refusal with the service URL
 * and reason interpolated - is resolved before the pure twin sees a prop.
 */
export const BrowsePage = async (props: BrowsePageProps) => {
    void props
    const [t, sessionToken] = await Promise.all([getTranslations("shop.browse"), readSessionToken()])
    const result = sessionToken
        ? await fetchProducts(sessionToken)
        : { ok: false as const, reason: "no signed-in session", code: "SESSION_INVALID" }
    return (
        <BrowsePageBase
            state={browsePageStateOf(result)}
            props={{
                title: t("title"),
                description: result.ok && result.data.length > 0
                    ? t("descriptionCount", { count: result.data.length })
                    : t("description"),
                products: result.ok ? result.data : [],
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
