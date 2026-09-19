import createMiddleware from "next-intl/middleware"
import type { NextRequest } from "next/server"
import { routing } from "@/i18n/routing"

const intlMiddleware = createMiddleware(routing)

/**
 * The one thing that runs before a route exists: deciding which language it is in.
 *
 * A request for `/tasks` carries no locale, so something has to choose one and send the reader to
 * the addressed form. next-intl's middleware is that something: it reads the cookie this app
 * sets, negotiates `Accept-Language` otherwise, and redirects to the prefixed path.
 */
const middleware = (request: NextRequest) => intlMiddleware(request)

export default middleware

/** Which requests this middleware is allowed to touch, and by omission which it must leave alone. */
export const config = {
    /*
   * Everything except the things that are not pages.
   *
   * `_next` is the build output, `api` is not localised, and the last alternative excludes any
   * path with a dot in it - `favicon.ico`, `sign-in/turtle-master.png`, every file under
   * `public/`. Without that last one the middleware would redirect an asset request to
   * `/en/logo.svg` and the file would 404 in one locale and not the other; the brand turtle's own
   * route handler lives at the unprefixed path for exactly this reason.
   */
    matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
