import type { AcceptLanguage, Locale, MessageParams } from "./i18n.contracts"

/** The message catalog port: a keyed lookup with named interpolation over the bundles the app composes. */
export interface MessageCatalog {
    /** The text of `key` in `locale` with `{{name}}` placeholders filled from `params`; an unknown key answers the key itself. */
    get(key: string, params: MessageParams, locale: Locale): string
}

/** Picks the locale of one request. */
export interface RequestLocale {
    /** The locale of an `Accept-Language` header value: Vietnamese or English, Vietnamese when it names neither. */
    of(acceptLanguage: AcceptLanguage): Locale
}
