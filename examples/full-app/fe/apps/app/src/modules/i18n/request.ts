import { createRequestConfig } from "@ecommerce/i18n/request"

/** Loads the shop app's own catalogue of the requested locale; the i18n package resolves the locale and the time zone. */
export default createRequestConfig("app", (locale) => import(`./messages/${locale}.json`))
