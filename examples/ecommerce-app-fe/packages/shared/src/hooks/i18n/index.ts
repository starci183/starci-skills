import { createI18nNavigation } from "@starci-examples/fe-kit/i18n/navigation"
import { routing } from "../../modules/i18n/routing"

/**
 * NAVIGATION THAT KNOWS WHICH LANGUAGE THE READER IS IN.
 *
 * With the locale in the path, `router.push("/cart")` has to mean `/vi/cart` for a Vietnamese
 * reader and `/en/cart` for an English one, and the difference cannot be left to each call site:
 * one forgotten prefix drops a reader out of their language mid-journey. The prefixing happens
 * HERE, once. Call sites keep writing the locale-free path and import these helpers instead of
 * `next/navigation` - shared by both apps, so the two front doors behave identically.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createI18nNavigation(routing)
