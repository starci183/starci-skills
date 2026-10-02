import "server-only"
import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { routing } from "./routing"

/** Resolves the locale of a request and loads its catalog; an unknown locale falls back to the default. */
export default getRequestConfig(async ({ requestLocale }) => {
    const requested = await requestLocale
    const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
    return {
        locale,
        messages: (await import(`./messages/${locale}.json`)).default,
    }
})
