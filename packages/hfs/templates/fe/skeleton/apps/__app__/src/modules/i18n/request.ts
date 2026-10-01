import "server-only"
import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { locale as routeLocale } from "next/root-params"
import { routing } from "./routing"

/**
 * Resolves the locale of a request and loads its catalog; an unknown locale falls back to the default. The locale is the
 * `[locale]` route param read through `next/root-params` (`experimental.rootParams` in next.config.ts), not the deprecated
 * `requestLocale`.
 */
export default getRequestConfig(async () => {
    const requested: unknown = await routeLocale()
    const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
    return {
        locale,
        messages: (await import(`./messages/${locale}.json`)).default,
    }
})
