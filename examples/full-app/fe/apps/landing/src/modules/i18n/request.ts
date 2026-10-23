import { createRequestConfig } from "@ecommerce/i18n/request"

/** Loads the landing app's own catalogue of the requested locale; the i18n package resolves the locale and the time zone. */
export default createRequestConfig("landing", (locale) => import(`./messages/${locale}.json`))
