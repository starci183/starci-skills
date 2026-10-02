import { defineRouting } from "next-intl/routing"

/**
 * The locale vocabulary of the product, declared once for every app: the locales list, the `northwind-`
 * cookie name and the product time zone are the same on the landing and shop origins, so `/vi` means the
 * same thing on both.
 */
export const LOCALES = ["en", "vi"] as const

/** The locale served when the reader has expressed no preference. */
export const DEFAULT_LOCALE = "en"

/** Stable product time zone shared by server formatting and the hydrated client provider. */
export const PRODUCT_TIME_ZONE = "Asia/Ho_Chi_Minh"

/** The one routing table of the product: the locale is part of the address, and a returning reader's choice is remembered in a cookie for a year. */
export const routing = defineRouting({
    locales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    localeCookie: { name: "northwind-locale", maxAge: 60 * 60 * 24 * 365, path: "/" },
})
