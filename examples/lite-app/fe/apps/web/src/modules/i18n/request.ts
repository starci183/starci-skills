import "server-only"
import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { locale as routeLocale } from "next/root-params"
import { PRODUCT_TIME_ZONE, routing } from "./routing"

/** The request config next-intl's plugin loads; the locale is the `[locale]` route param read through `next/root-params` (`experimental.rootParams`). */
export default getRequestConfig(async () => {
    const requested: unknown = await routeLocale()
    const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
    return {
        locale,
        timeZone: PRODUCT_TIME_ZONE,
        messages: (await import(`./messages/${locale}.json`)).default,
        getMessageFallback: ({ namespace, key }) => `web:${namespace ?? ""}.${key}`,
    }
})
