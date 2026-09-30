/** The locales this app ships copy for; every catalog under `messages/` has the same keys. */
export const LOCALES = ["en", "vi"] as const

/** A served locale. */
export type Locale = (typeof LOCALES)[number]

/** The locale served when the reader has expressed no preference. */
export const DEFAULT_LOCALE: Locale = "en"

/** The cookie the reader's language choice is remembered in. */
export const LOCALE_COOKIE = "starci-locale"

/** How long the choice is remembered: a year, because a language is a preference and not a session. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Stable product timezone shared by server formatting and the hydrated client provider. */
export const PRODUCT_TIME_ZONE = "Asia/Ho_Chi_Minh"
