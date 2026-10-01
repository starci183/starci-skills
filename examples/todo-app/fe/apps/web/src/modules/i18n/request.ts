import "server-only"
import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { PRODUCT_TIME_ZONE } from "./config"
import { routing } from "./routing"

/**
 * Where copy comes from, resolved once per request on the server. The locale comes from the route
 * (`requestLocale`) and is checked against the shipped vocabulary before it reaches the loader; the
 * time zone is fixed, so the server and the hydrated client format the same day the same way.
 */
export default getRequestConfig(async ({ requestLocale }) => {
    const requested = await requestLocale
    const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
    return {
        locale,
        timeZone: PRODUCT_TIME_ZONE,
        messages: (await import(`./messages/${locale}.json`)).default,
    }
})
