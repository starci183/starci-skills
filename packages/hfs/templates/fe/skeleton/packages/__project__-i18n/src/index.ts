import "server-only"
import { hasLocale } from "next-intl"
import type { AbstractIntlMessages } from "next-intl"
import { createNavigation } from "next-intl/navigation"
import { getMessages, getRequestConfig } from "next-intl/server"
import { notFound } from "next/navigation"
import { locale as routeLocale } from "next/root-params"
import { PRODUCT_TIME_ZONE, routing } from "./routing"

/** Loads one app's own catalog for a served locale. */
type LoadMessages = (locale: string) => Promise<unknown>

/** The missing message next-intl asks a fallback for. */
type MissingMessage = { readonly namespace?: string; readonly key: string }

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

/**
 * The next-intl stack of one app of the product, written once here and called once by each app's `modules/i18n` (R59): the
 * product's one routing with its locale-aware navigation, the request config next-intl's plugin loads (the app's
 * `modules/i18n/request.ts` default-exports it) and what the app's `[locale]` layout resolves before it mounts the shell. `app` names
 * the app in the text of a message its catalog lacks (`<app>:<namespace>.<key>`); `loadMessages` loads its own catalogs. A server
 * module: a client component reads the default locale from `./routing`.
 */
export const createAppI18n = (app: string, loadMessages: LoadMessages) => ({
    navigation: createNavigation(routing),
    /**
     * The locale is the `[locale]` route param read through `next/root-params` (`experimental.rootParams` in the app's next.config.ts,
     * FE-I18N-1), never the deprecated `requestLocale`. An unrecognised locale resolves to the default before the loader runs, so a
     * missing catalog file is never imported.
     */
    requestConfig: getRequestConfig(async () => {
        const requested = await readRouteLocale()
        const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
        return {
            locale,
            timeZone: PRODUCT_TIME_ZONE,
            messages: messagesOf(await loadMessages(locale)),
            getMessageFallback: ({ namespace, key }: MissingMessage) => `${app}:${namespace ?? ""}.${key}`,
        }
    }),
    /**
     * The language the address states, its catalog and the product time zone. An unknown segment is a route that does not exist,
     * not a request to fall back silently.
     */
    readLocaleSegment: async (params: Promise<{ readonly locale: string }>) => {
        const { locale } = await params
        if (!hasLocale(routing.locales, locale)) notFound()
        return { locale, messages: await getMessages(), timeZone: PRODUCT_TIME_ZONE }
    },
})
