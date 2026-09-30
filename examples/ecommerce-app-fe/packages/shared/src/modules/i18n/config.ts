import { defineI18nConfig } from "@starci-examples/fe-kit/i18n/config"

/**
 * The locale vocabulary of the product, declared once for every app: the locales list, the
 * `northwind-` cookie name and the product timezone are the same on the landing and shop origins,
 * so `/vi` means the same thing on both. Nothing here runs only on a server: `request.ts` in each
 * app resolves the request locale through next-intl's server entry, so client code reads these
 * names from here, never from a request reader.
 */
export const i18n = defineI18nConfig({
    locales: ["en", "vi"] as const,
    defaultLocale: "en",
    localeCookie: "northwind-locale",
    timeZone: "Asia/Ho_Chi_Minh",
})

/** Stable product timezone shared by server formatting and the hydrated client provider. */
export const PRODUCT_TIME_ZONE = i18n.PRODUCT_TIME_ZONE
