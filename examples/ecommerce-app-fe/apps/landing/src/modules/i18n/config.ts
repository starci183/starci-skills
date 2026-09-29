import { defineI18nConfig } from "@starci-examples/fe-kit/i18n/config"

/**
 * The locale vocabulary of this app, and nothing that only runs on a server: `request.ts` resolves
 * the request locale through next-intl's server entry, so a client component imports these names
 * from here (through the module's index), never from the request reader.
 *
 * The mechanism lives in `@starci-examples/fe-kit`; what is per-product stays per-product: the
 * locales list, the `northwind-` cookie name and the product timezone are declared here, and the
 * landing and shop apps declare the same values so `/vi` means the same thing on both origins.
 */
export const i18n = defineI18nConfig({
    locales: ["en", "vi"] as const,
    defaultLocale: "en",
    localeCookie: "northwind-locale",
    timeZone: "Asia/Ho_Chi_Minh",
})

/** One of the locales the product ships. */
export type Locale = (typeof i18n.LOCALES)[number]

/** Stable product timezone shared by server formatting and the hydrated client provider. */
export const PRODUCT_TIME_ZONE = i18n.PRODUCT_TIME_ZONE
