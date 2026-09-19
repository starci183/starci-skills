import { defineI18nConfig } from "@fe-kit/i18n/config"

/**
 * The locale vocabulary, and NOTHING that only runs on a server.
 *
 * This file exists because of a boundary the type checker cannot see. `request.ts` resolves the
 * request locale, so it imports `next-intl/server`, so it is server-only - and the moment a client
 * component imported one constant from it, the whole module would be pulled into the browser
 * bundle. So the names live here, where both sides may read them, and the reading of the request
 * stays next door.
 *
 * The mechanism lives in `@starci-examples/fe-kit`; what is per-app stays per-app - the locales
 * list, the cookie name and the product timezone are declared here, so two products sharing the
 * kit never silently share a cookie.
 */

/** The app-bound vocabulary: locales, default, cookie name and product timezone, written once. */
export const i18n = defineI18nConfig({
    locales: ["en", "vi"] as const,
    defaultLocale: "en",
    localeCookie: "starci-locale",
    timeZone: "Asia/Ho_Chi_Minh",
})

/** One of the locales the app ships. */
export type Locale = (typeof i18n.LOCALES)[number];

/** Stable product timezone shared by server formatting and the hydrated client provider. */
export const PRODUCT_TIME_ZONE = i18n.PRODUCT_TIME_ZONE
