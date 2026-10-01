import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing"

/**
 * Navigation that knows which language the reader is in: call sites write the locale-free path and
 * these helpers re-prefix it, so one forgotten prefix cannot drop a reader out of their language.
 * Components import these instead of `next/link` and `next/navigation`; the two hooks of the
 * created navigation are reached through `hooks/navigation`, where authored hooks live.
 */
export const navigation = createNavigation(routing)

/** The locale-aware server redirect: `{ href, locale }` re-prefixes the path for the given language. */
export const redirect = navigation.redirect
