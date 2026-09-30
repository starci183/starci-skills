import { createRequestConfig } from "@{{family}}/i18n/request"
import { routing } from "./index"

/** Loads the catalog of the requested locale from this app's `messages/`; the shared package resolves the locale. */
export default createRequestConfig(routing, async (locale) => (await import(`./messages/${locale}.json`)).default)
