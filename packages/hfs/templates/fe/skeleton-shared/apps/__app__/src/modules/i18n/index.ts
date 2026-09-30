import { createAppI18n } from "@{{family}}/i18n"

/** This app's locales and the next-intl stack (routing, navigation) built from them by the shared i18n package. */
const i18n = createAppI18n({ locales: ["vi"], defaultLocale: "vi" })

export const { DEFAULT_LOCALE, LOCALES, getPathname, Link, redirect, routing, usePathname, useRouter } = i18n

/** A served locale. */
export type Locale = (typeof LOCALES)[number]
