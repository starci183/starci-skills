import "server-only"
import { hasLocale } from "next-intl"
import type { AbstractIntlMessages } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { headers } from "next/headers"
import { PRODUCT_TIME_ZONE, routing } from "./routing"

/** The message tree a catalog module exports as its default: the module is read as `unknown` and checked, never trusted as `any`. */
const isMessages = (value: unknown): value is AbstractIntlMessages => typeof value === "object" && value !== null

const messagesOf = (loaded: unknown): AbstractIntlMessages => {
    const messages = typeof loaded === "object" && loaded !== null && "default" in loaded ? loaded.default : undefined
    if (!isMessages(messages)) throw new TypeError("A message catalog module must export its messages as default")
    return messages
}

/** The header the next-intl middleware sets on the request with the locale it negotiated. */
const LOCALE_HEADER = "x-next-intl-locale"

/**
 * The request config next-intl's plugin loads. The locale is the one the middleware negotiated: this module is reachable from the proxy
 * through the navigation, and `next/root-params` can only be imported inside the app directory.
 */
export default getRequestConfig(async () => {
    const requested = (await headers()).get(LOCALE_HEADER)
    const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
    return {
        locale,
        timeZone: PRODUCT_TIME_ZONE,
        messages: messagesOf(await import(`./messages/${locale}.json`)),
        getMessageFallback: ({ namespace, key }) => `web:${namespace ?? ""}.${key}`,
    }
})
