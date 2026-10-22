import "server-only"
import { hasLocale } from "next-intl"
import type { AbstractIntlMessages } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { locale as routeLocale } from "next/root-params"
import { DEFAULT_LOCALE, LOCALES, PRODUCT_TIME_ZONE } from "./routing"

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

/** The apps of the product. */
type AppName = "landing" | "app"

/** Loads one app's own catalogue for a served locale. */
type LoadMessages = (locale: string) => Promise<unknown>

/** The missing message next-intl asks a fallback for. */
type MissingMessage = { readonly namespace?: string; readonly key: string }

/**
 * Where copy comes from, resolved once per request on the server: the app's own catalogue. The locale is the
 * `[locale]` route param read through `next/root-params` (`experimental.rootParams` in the app's next.config.ts),
 * never the deprecated `requestLocale`, and an unrecognised segment resolves to the default before the loader
 * runs, so a missing file is never imported. The time zone is fixed, not inferred, so the server and the
 * hydrated client format the same instant the same way. A key an app's catalogue lacks renders as
 * `<app>:<namespace>.<key>`, so the app that forgot it is named on the page. The app's `request.ts` default-exports
 * this for next-intl's plugin, which takes the request config as a plain function.
 */
export const createRequestConfig = (app: AppName, loadMessages: LoadMessages) =>
    getRequestConfig(async () => {
        const requested = await readRouteLocale()
        const locale = hasLocale(LOCALES, requested) ? requested : DEFAULT_LOCALE
        return {
            locale,
            timeZone: PRODUCT_TIME_ZONE,
            messages: messagesOf(await loadMessages(locale)),
            getMessageFallback: ({ namespace, key }: MissingMessage) => `${app}:${namespace ?? ""}.${key}`,
        }
    })
