import { createProxy } from "@{{family}}/i18n/proxy"
import { routing } from "./modules/i18n"

/** Negotiates the locale and redirects; the default locale (vi) is served without a prefix. */
export default createProxy(routing)
