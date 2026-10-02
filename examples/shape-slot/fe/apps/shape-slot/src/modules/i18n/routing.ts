import { defineRouting } from "next-intl/routing"
import { DEFAULT_LOCALE, LOCALES } from "./config"

/** One routing table for the proxy, the navigation helpers and the request config: vi default, prefix only when not default. */
export const routing = defineRouting({
    locales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    localePrefix: "as-needed",
})
