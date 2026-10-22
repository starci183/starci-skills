import "server-only"
import { hasLocale } from "next-intl"
import type { AbstractIntlMessages } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { locale as routeLocale } from "next/root-params"
import { routing } from "./routing"

/** The message tree a catalog module exports as its default: the module is read as `unknown` and checked, never trusted as `any`. */
const isMessages = (value: unknown): value is AbstractIntlMessages => typeof value === "object" && value !== null

const messagesOf = (loaded: unknown): AbstractIntlMessages => {
    const messages = typeof loaded === "object" && loaded !== null && "default" in loaded ? loaded.default : undefined
    if (!isMessages(messages)) throw new TypeError("A message catalog module must export its messages as default")
    return messages
}

/** `next/root-params` is typed only after Next generates its types, so the reader is checked before it is called. */
const isLocaleReader = (value: unknown): value is () => Promise<unknown> => typeof value === "function"

const readRouteLocale = async (): Promise<unknown> => (isLocaleReader(routeLocale) ? routeLocale() : undefined)

/** Resolves the locale of a request from the `[locale]` route param (`next/root-params`) and loads its catalog; an unknown locale falls back to the default. */
export default getRequestConfig(async () => {
    const requested = await readRouteLocale()
    const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
    return {
        locale,
        messages: messagesOf(await import(`./messages/${locale}.json`)),
    }
})
