import { defineRouting } from "next-intl/routing"
import type { FeKitI18nConfig } from "./config"

/**
 * THE LOCALE IS PART OF THE ADDRESS.
 *
 * A Vietnamese page has a Vietnamese URL, so it can be linked, shared, bookmarked and indexed as
 * the thing the reader actually saw. A cookie cannot do any of those, because it is not in the
 * link.
 *
 * THE COOKIE STAYS, in a smaller job. It no longer decides what a URL means - the segment does -
 * but it still remembers which language a returning reader chose, so `/` sends them where they
 * were rather than to the default every time.
 *
 * `createRouting` wraps next-intl's `defineRouting` so the routing object derives entirely from
 * the app's `defineI18nConfig` result: locales, default and the cookie name/max-age it declared.
 *
 * @param config - The app-bound vocabulary from {@link defineI18nConfig}.
 */
export const createRouting = <L extends ReadonlyArray<string>>(config: FeKitI18nConfig<L>) =>
    defineRouting({
        locales: config.LOCALES,
        defaultLocale: config.DEFAULT_LOCALE,
        localeCookie: {
            name: config.LOCALE_COOKIE,
            maxAge: config.LOCALE_COOKIE_MAX_AGE,
            path: "/",
        },
    })
