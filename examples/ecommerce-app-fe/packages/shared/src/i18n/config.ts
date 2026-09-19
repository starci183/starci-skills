import { defineI18nConfig } from "@fe-kit/i18n/config"

/**
 * The locale vocabulary for BOTH apps, and nothing that only runs on a server.
 *
 * This file exists because of a boundary the type checker cannot see: `request.ts` resolves the
 * request locale through next-intl's server entry, so anything a client component imports from it
 * would pull the server module into the browser bundle. The names live here, where the landing
 * app, the shop app and the server request reader may all read them - the single source of the
 * locale list, so the two apps can never drift apart on which languages the product ships.
 *
 * The mechanism lives in `@starci-examples/fe-kit`; what is per-product stays per-product - the
 * locales list, the `northwind-` cookie name and the product timezone are declared here.
 */

/** The product-bound vocabulary: locales, default, cookie name and timezone, written once. */
export const i18n = defineI18nConfig({
    locales: ["en", "vi"] as const,
    defaultLocale: "en",
    localeCookie: "northwind-locale",
    timeZone: "Asia/Ho_Chi_Minh",
})

/** One of the locales the product ships. */
export type Locale = (typeof i18n.LOCALES)[number];

/** Stable product timezone shared by server formatting and the hydrated client provider. */
export const PRODUCT_TIME_ZONE = i18n.PRODUCT_TIME_ZONE
