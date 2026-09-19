"use client"

import { createContext, useContext, type ReactNode } from "react"

const ShopUrlContext = createContext<string | undefined>(undefined)

/** The value the provider carries: the shop origin resolved once on the server. */
export type ShopUrlProviderProps = {
    readonly shopUrl: string
    readonly children: ReactNode
}

/**
 * Carry the server-resolved shop origin into the client tree. `SHOP_URL` is a server-only read -
 * it falls back to the port projection through `node:fs` - so the route layout resolves it once and
 * the chrome reads it back through this context, the same bridge the locale and messages already
 * take through `AppProviders`.
 */
export const ShopUrlProvider = (props: ShopUrlProviderProps) => (
    <ShopUrlContext.Provider value={props.shopUrl}>{props.children}</ShopUrlContext.Provider>
)

/** The shop origin the server resolved; a missing provider is a programming error, not a state. */
export const useShopUrl = (): string => {
    const shopUrl = useContext(ShopUrlContext)
    if (shopUrl === undefined) {
        throw new Error("useShopUrl must run under ShopUrlProvider")
    }
    return shopUrl
}
