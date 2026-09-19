/**
 * The locale vocabulary factory, and NOTHING that only runs on a server.
 *
 * This file exists because of a boundary the type checker cannot see. `request.ts` resolves the
 * request locale, so it imports `next-intl/server`, so it is server-only - and the moment a client
 * component imported one constant from it, the whole module would be pulled into the browser
 * bundle. So the vocabulary is declared here, where both sides may read it, and the reading of
 * the request stays next door.
 *
 * What is per-app stays per-app: the locales list, the cookie name and the product timezone are
 * passed in by the consumer, so two products sharing this kit never silently share a cookie.
 */

/** The app-specific answers the kit's i18n plumbing is parameterised with. */
export type FeKitI18nOptions<L extends ReadonlyArray<string> = ReadonlyArray<string>> = {
    /** The locales the app ships copy for. The first is what an unrecognised cookie falls back to. */
    readonly locales: L;
    /** The locale served when the reader has expressed no preference. */
    readonly defaultLocale: L[number];
    /** The cookie the reader's choice is remembered in. */
    readonly localeCookie: string;
    /** Stable product timezone shared by server formatting and the hydrated client provider. */
    readonly timeZone: string;
};

/**
 * The vocabulary `defineI18nConfig` returns. Everything a consumer or a kit leaf needs to speak
 * about locales without knowing which app it is running inside.
 */
export type FeKitI18nConfig<L extends ReadonlyArray<string> = ReadonlyArray<string>> = {
    /** The locales this app ships copy for. */
    readonly LOCALES: L;
    /** The locale served when the reader has expressed no preference. */
    readonly DEFAULT_LOCALE: L[number];
    /** The cookie the reader's choice is remembered in. */
    readonly LOCALE_COOKIE: string;
    /**
     * How long the choice is remembered. A year: a language is a preference, not a session, and a
     * reader who has to pick it again every visit will conclude the product does not listen.
     */
    readonly LOCALE_COOKIE_MAX_AGE: number;
    /** Stable product timezone shared by server formatting and the hydrated client provider. */
    readonly PRODUCT_TIME_ZONE: string;
    /**
     * Narrow an arbitrary cookie value to a locale the app actually ships. A cookie is
     * reader-supplied text, so it is checked rather than trusted: an unknown value resolves to
     * the default instead of reaching the message loader and throwing on a file that does not exist.
     */
    readonly toLocale: (value: string | undefined) => L[number];
};

/**
 * Bind the kit's i18n plumbing to one app. The returned object feeds `createRouting`,
 * `createI18nNavigation` and `createRequestConfig`, so the locales list, cookie name and timezone
 * are written down exactly once per consumer.
 *
 * @param options - {@link FeKitI18nOptions}
 */
export const defineI18nConfig = <L extends ReadonlyArray<string>>(
    options: FeKitI18nOptions<L>,
): FeKitI18nConfig<L> => ({
        LOCALES: options.locales,
        DEFAULT_LOCALE: options.defaultLocale,
        LOCALE_COOKIE: options.localeCookie,
        LOCALE_COOKIE_MAX_AGE: 60 * 60 * 24 * 365,
        PRODUCT_TIME_ZONE: options.timeZone,
        toLocale: (value: string | undefined): L[number] =>
            options.locales.includes(value as L[number]) ? (value as L[number]) : options.defaultLocale,
    })
