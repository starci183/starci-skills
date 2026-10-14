"use client"

import { useFormatter, useTranslations } from "next-intl"
import { collectionSlot } from "@ecommerce/ui"
import { useAddToCart, useCartView } from "../../../hooks/cart"
import { orderApiUrl } from "../../../modules/config"
import { BrowseCatalogueBase } from "./component"

/**
 * The connected catalogue of the browse page. The catalogue rides the order service's session-guarded `cart` query, read in the browser
 * through the cart hook: no live session is the signed-out gate, a failed read is the refusal (naming the service's
 * address), and a reachable service with zero rows is the genuine empty. Every price is formatted in the reader's
 * language (the service answers minor units, billed in US dollars) before the pure twin sees a prop.
 */
export const BrowseCatalogue = () => {
    const t = useTranslations("shop.browse")
    const tLoading = useTranslations("shop.loading")
    const format = useFormatter()
    const read = useCartView()
    const add = useAddToCart()
    const catalog = read.status === "ready" ? read.view.catalog : null
    const products =
        catalog === null
            ? null
            : catalog.map((product) => ({
                  id: product.id,
                  name: product.name,
                  price: format.number(product.priceMinorUnits / 100, { style: "currency", currency: "USD" }),
                  stock: product.stock,
              }))
    return (
        <BrowseCatalogueBase
            state={read.status === "signedOut" ? "signedOut" : "browse"}
            props={{
                loadingLabel: tLoading("message"),
                title: t("title"),
                description:
                    catalog !== null && catalog.length > 0
                        ? t("descriptionCount", { count: catalog.length })
                        : t("description"),
                productsSlot: read.status === "loading" ? { status: "loading" } : collectionSlot(products),
                stockLabel: t.raw("stockLabel"),
                addToCart: t("addToCart"),
                addingToCart: t("addingToCart"),
                inCartLabel: t.raw("inCartLabel"),
                addRefused: t("addRefused"),
                signedOutTitle: t("signedOut.title"),
                signedOutDescription: t("signedOut.description"),
                unreachableTitle: t("unreachable.title"),
                unreachableDescription:
                    read.status === "error" ? t("unreachable.description", { url: orderApiUrl() }) : "",
                emptyTitle: t("empty.title"),
                emptyDescription: t("empty.description"),
                ...add.props,
            }}
            on={add.on}
        />
    )
}
