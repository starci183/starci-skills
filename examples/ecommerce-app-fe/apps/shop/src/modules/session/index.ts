import "server-only"
import { cookies } from "next/headers"
import { SESSION_COOKIE_DOMAIN, SESSION_COOKIE_SECURE } from "../config"

/**
 * THE SETTLED SESSION CARRIER - the landing -> shop handoff, concretely.
 *
 * `identity`'s `signIn` mutation mints an opaque bearer token; this app carries it in one httpOnly
 * cookie named `northwind-session`, with the person it authenticated beside it in
 * `northwind-person` (the shop asks identity `account(personId)` for who this is - the token
 * itself stays an opaque bearer and is never decoded). Cookies do not bind to a port, so a session
 * opened through the shop accompanies the browser to the landing and back on `localhost` - the
 * handoff is the browser carrying the cookie, never a token in a URL. A deployment that serves the
 * two apps on separate hostnames keeps the identical contract by setting `SHOP_SESSION_COOKIE_DOMAIN`
 * to the shared parent domain.
 *
 * Both halves are `httpOnly`: nothing in page JavaScript may read or write them, so they are set
 * and cleared only by the app's own `/api/session` door and read only by server code (below).
 * `SameSite=Lax` keeps them off cross-site POSTs.
 */
export const SESSION_COOKIE = "northwind-session"

/** The person id the session authenticated, carried beside the bearer so server reads can name who without a second hop. */
export const PERSON_COOKIE = "northwind-person"

/**
 * The server half of the session seam: the cookies the browser presented on this request, read by
 * connected pages and route handlers - never by a client component, which cannot see the request.
 *
 * The bearer token is what the order service's SessionGuard verifies against identity over real
 * HTTP; the person id is the handle identity's `account(personId)` query answers. An absent cookie
 * is an anonymous visitor, not an error - pages degrade to their signed-out state rather than
 * inventing a session.
 */
export const readSessionToken = async (): Promise<string | null> => (await cookies()).get(SESSION_COOKIE)?.value ?? null

/**
 * The cookie's lifetime: a mirror of the identity service's default TTL
 * (`IDENTITY_SESSION_TTL_SECONDS`, one hour). A cookie that outlives its session is harmless - the
 * verify door still refuses the dead token and the surface settles as anonymous.
 */
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60

/** The attributes the session door applies when it writes or clears the pair onto a response. Host-only by default. */
export const SESSION_COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    domain: SESSION_COOKIE_DOMAIN,
    secure: SESSION_COOKIE_SECURE,
} as const
