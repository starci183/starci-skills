import { defineRouting } from "next-intl/routing"
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALES } from "./config"

/**
 * The locale is part of the address: a Vietnamese page has a Vietnamese URL, so it can be linked,
 * shared, bookmarked and indexed as the thing the reader actually saw. The cookie stays in a smaller
 * job: it remembers which language a returning reader chose, so `/` sends them where they were.
 */
export const routing = defineRouting({
    locales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    localeCookie: { name: LOCALE_COOKIE, maxAge: LOCALE_COOKIE_MAX_AGE, path: "/" },
})
