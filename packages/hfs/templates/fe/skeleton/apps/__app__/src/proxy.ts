import createMiddleware from "next-intl/middleware"
import { routing } from "./modules/i18n/routing"

/** Negotiates the locale and redirects; the default locale (vi) is served without a prefix. */
export default createMiddleware(routing)

/** Everything except the API, the health probe, framework files and files with an extension. */
export const config = {
    matcher: ["/((?!api|health|_next|_vercel|.*\\..*).*)"],
}
