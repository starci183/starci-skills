import { createNavigation } from "next-intl/navigation"

const LOCALES = ["vi"] as const

/** The locale served at the unprefixed path and used by the global error boundary. */
export const DEFAULT_LOCALE = "vi" as const
/** The fixed product time zone used by the server and hydrated client. */
export const PRODUCT_TIME_ZONE = "Asia/Ho_Chi_Minh"

/** The one locale-routing table of the web app. */
export const routing = {
    locales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    localePrefix: "as-needed" as const,
}

/** Locale-aware navigation for app-owned links. */
export const navigation = createNavigation(routing)
