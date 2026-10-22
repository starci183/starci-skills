import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing"

export { DEFAULT_LOCALE, LOCALES, PRODUCT_TIME_ZONE, routing } from "./routing"

/** The locale-aware navigation over the product's routing: apps import `redirect` and the hooks from here, never from `next/navigation`. */
export const navigation = createNavigation(routing)

/** The locale-aware server redirect: `{ href, locale }` re-prefixes the path for the given language. */
export const redirect = navigation.redirect
