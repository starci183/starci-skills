import { createNavigation } from "next-intl/navigation"
import { defineRouting } from "next-intl/routing"

/** The locales an app serves and the one it serves at the unprefixed path. */
export interface AppI18nOptions<Locale extends string> {
    readonly locales: readonly [Locale, ...Locale[]]
    readonly defaultLocale: Locale
}

/**
 * The next-intl stack of one app, written once for the repository: one routing table (default locale unprefixed) and the
 * locale-aware navigation built on it. Components import `Link` and `redirect` from their app's i18n module, never from
 * `next/link` or `next/navigation`. The proxy and the request config are the `./proxy` and `./request` entries, so a client
 * bundle that imports this one carries no server code.
 */
export const createAppI18n = <const Locale extends string>({ locales, defaultLocale }: AppI18nOptions<Locale>) => {
    const routing = defineRouting({ locales, defaultLocale, localePrefix: "as-needed" })
    return { LOCALES: locales, DEFAULT_LOCALE: defaultLocale, routing, ...createNavigation(routing) }
}
