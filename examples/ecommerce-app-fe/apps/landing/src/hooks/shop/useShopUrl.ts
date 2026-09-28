import { useContext } from "react"
import { ShopUrlContext } from "../../modules/shop-url"

/** The server resolved shop origin; a missing provider is a programming error. */
export const useShopUrl = (): string => {
    const shopUrl = useContext(ShopUrlContext)
    if (shopUrl === undefined) throw new Error("useShopUrl must run under ShopUrlProvider")
    return shopUrl
}
