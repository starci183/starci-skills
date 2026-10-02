import { hasLocale } from "next-intl"
import { createNavigation } from "next-intl/navigation"
import { getMessages, getRequestConfig, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { locale as routeLocale } from "next/root-params"

const LOCALES = ["vi"] as const

/** The locale served at the unprefixed path and used by the global error boundary. */
export const DEFAULT_LOCALE = "vi"
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

/** What the locale layout resolves before mounting providers. */
export const readLocaleSegment = async (params: Promise<{ readonly locale: string }>) => {
    const { locale } = await params
    if (!hasLocale(routing.locales, locale)) notFound()
    setRequestLocale(locale)
    return { locale, messages: await getMessages(), timeZone: PRODUCT_TIME_ZONE }
}

/** The request config loaded by next-intl's Next plugin. */
export const requestConfig = getRequestConfig(async () => {
    const requested: unknown = await routeLocale()
    const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
    return {
        locale,
        timeZone: PRODUCT_TIME_ZONE,
        messages: (await import(`./messages/${locale}.json`)).default,
        getMessageFallback: ({ namespace, key }) => `web:${namespace ?? ""}.${key}`,
    }
})
