/** The locales the {{app}} app serves; every catalog under `messages/` has the same keys. */
export const LOCALES = ["vi"] as const

/** A served locale. */
export type Locale = (typeof LOCALES)[number]

/** The locale served at the unprefixed path. */
export const DEFAULT_LOCALE: Locale = "vi"
