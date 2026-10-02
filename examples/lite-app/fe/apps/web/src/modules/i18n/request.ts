import "server-only"
import { hasLocale } from "next-intl"
import { getMessages, getRequestConfig, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { PRODUCT_TIME_ZONE, routing } from "./index"

/** What the locale layout resolves before mounting providers. */
export const readLocaleSegment = async (params: Promise<{ readonly locale: string }>) => {
    const { locale } = await params
    if (!hasLocale(routing.locales, locale)) notFound()
    setRequestLocale(locale)
    return { locale, messages: await getMessages(), timeZone: PRODUCT_TIME_ZONE }
}

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
