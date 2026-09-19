import createMiddleware from "next-intl/middleware"
import { routing } from "@shared/i18n/routing"

/**
 * The one thing that runs before a route exists: deciding which language it is in. A request for
 * `/browse` carries no locale, so something has to choose one and send the reader to the addressed
 * form - next-intl's middleware reads the cookie, falls back to the default, and redirects to the
 * prefixed path. Same shared routing as the landing app, so `/vi` means the same thing on both
 * origins.
 */
export default createMiddleware(routing)

/** The routes this negotiation runs for - pages only, never assets or API calls. */
export const config = {
    /*
   * Everything except the things that are not pages: `_next` is the build output, `api` is not
   * localised, and the last alternative excludes any path with a dot in it - `favicon.ico`, every
   * asset under `public/` - so an image request is never redirected to `/en/logo.svg`.
   */
    matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
