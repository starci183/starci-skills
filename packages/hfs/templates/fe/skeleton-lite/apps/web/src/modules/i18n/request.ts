import "server-only"
import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { PRODUCT_TIME_ZONE, routing } from "./routing"

/** The request config next-intl's plugin loads. */
export default getRequestConfig(async ({ requestLocale }) => {
    const requested = await requestLocale
    const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
    return {
        locale,
        timeZone: PRODUCT_TIME_ZONE,
        messages: (await import(`./messages/${locale}.json`)).default,
        getMessageFallback: ({ namespace, key }) => `web:${namespace ?? ""}.${key}`,
    }
})
