import { defineRouting } from "next-intl/routing"

/** The locales every app of the product serves; every catalog of an app has the same keys in each. */
const LOCALES = ["vi"] as const

/** The locale served at the unprefixed path, and the language of a document no locale reached (the global error boundary). */
export const DEFAULT_LOCALE = "vi"

/** The product's time zone: fixed, not inferred, so the server and the hydrated client format the same instant the same way. */
export const PRODUCT_TIME_ZONE = "Asia/Ho_Chi_Minh"

/**
 * The one routing table of the product, for the proxy, the navigation and the request config of every app: vi default, a prefix
 * only when the locale is not the default, so `/vi` means the same thing on every app.
 */
export const routing = defineRouting({
    locales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    localePrefix: "as-needed",
})
