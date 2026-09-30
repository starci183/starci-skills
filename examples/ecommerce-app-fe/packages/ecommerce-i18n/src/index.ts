import { hasLocale } from "next-intl"
import { createNavigation } from "next-intl/navigation"
import { defineRouting } from "next-intl/routing"
import type { NextRequest } from "next/server"

/**
 * The locale vocabulary of the product, declared once for every app: the locales list, the `northwind-`
 * cookie name and the product time zone are the same on the landing and shop origins, so `/vi` means the
 * same thing on both.
 */
export const LOCALES = ["en", "vi"] as const

/** The locale served when the reader has expressed no preference. */
export const DEFAULT_LOCALE = "en"

/** Stable product time zone shared by server formatting and the hydrated client provider. */
export const PRODUCT_TIME_ZONE = "Asia/Ho_Chi_Minh"

/** The one routing table of the product: the locale is part of the address, and a returning reader's choice is remembered in a cookie for a year. */
export const routing = defineRouting({
    locales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    localeCookie: { name: "northwind-locale", maxAge: 60 * 60 * 24 * 365, path: "/" },
})

/** The locale-aware navigation over the product's routing: apps import `redirect` and the hooks from here, never from `next/navigation`. */
export const navigation = createNavigation(routing)

/** The locale-aware server redirect: `{ href, locale }` re-prefixes the path for the given language. */
export const redirect = navigation.redirect

/** The apps of the product. */
export type AppName = "landing" | "shop"

/** Loads one app's own catalogue for a served locale. */
type LoadMessages = (locale: string) => Promise<Record<string, unknown>>

/** What next-intl hands the request config: the locale of the request, as a promise. */
type RequestConfigParams = { readonly requestLocale: Promise<string | undefined> }

/** The missing message next-intl asks a fallback for. */
type MissingMessage = { readonly namespace?: string; readonly key: string }

/**
 * Where copy comes from, resolved once per request on the server: the app's own catalogue. The locale comes
 * from the `[locale]` route segment, and an unrecognised segment resolves to the default before the loader
 * runs, so a missing file is never imported. The time zone is fixed, not inferred, so the server and the
 * hydrated client format the same instant the same way. A key an app's catalogue lacks renders as
 * `<app>:<namespace>.<key>`, so the app that forgot it is named on the page. The app's `request.ts` default-exports
 * this for next-intl's plugin, which takes the request config as a plain function.
 */
export const createRequestConfig =
    (app: AppName, loadMessages: LoadMessages) =>
    async ({ requestLocale }: RequestConfigParams) => {
        const requested = await requestLocale
        const locale = hasLocale(LOCALES, requested) ? requested : DEFAULT_LOCALE
        return {
            locale,
            timeZone: PRODUCT_TIME_ZONE,
            messages: await loadMessages(locale),
            getMessageFallback: ({ namespace, key }: MissingMessage) => `${app}:${namespace ?? ""}.${key}`,
        }
    }

/**
 * The proxy of an app: negotiates the locale and redirects, and lets everything that is not a page through
 * untouched. The negotiation itself lives in `./proxy` and is loaded where the proxy runs, so a client bundle
 * that imports this entry carries no server code.
 */
export const proxy = async (request: NextRequest) => (await import("./proxy")).default(request)

/**
 * What an app's `[locale]` layout resolves before it mounts the shell: the language the address states and its
 * catalogue. An unknown language is a route that does not exist, not a request to fall back silently. The
 * server-only reading lives in `./layout` and is loaded where the layout runs.
 */
export const readLocaleSegment = async (params: Promise<{ readonly locale: string }>) =>
    (await import("./layout")).loadLocaleSegment(params)
