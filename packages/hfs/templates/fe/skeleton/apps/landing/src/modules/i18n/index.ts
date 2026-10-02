import { createAppI18n } from "@{{project}}/i18n"

/** The landing's i18n: the product's one next-intl stack (the i18n package), with this app's own catalogs under `messages/`. */
export const landingI18n = createAppI18n(
    "landing",
    async (locale) => (await import(`./messages/${locale}.json`)).default,
)
