import { createI18nNavigation } from "@starci-examples/fe-kit/i18n/navigation"
import { routing } from "./routing"

/**
 * Navigation that knows which language the reader is in. With the locale in the path,
 * `router.push("/cart")` has to mean `/vi/cart` for a Vietnamese reader; the prefixing happens
 * here, once, and call sites keep writing the locale-free path.
 */
export const { Link, usePathname, useRouter } = createI18nNavigation(routing)
