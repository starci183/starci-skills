import { createAppI18n } from "@{{project}}/i18n"

/** The product app's i18n: the product's one next-intl stack (the i18n package), with this app's own catalogs under `messages/`. */
export const appI18n = createAppI18n("app", (locale) => import(`./messages/${locale}.json`))
