import "server-only"
import { cookies } from "next/headers"
import { PERSON_COOKIE, SESSION_COOKIE } from "./shared"

/**
 * The server half of the session seam: the cookies the browser presented on this request, read by
 * connected pages and server actions - never by a client component, which cannot see the request.
 *
 * The bearer token is what the order service's SessionGuard verifies against identity over real
 * HTTP; the person id is the handle identity's `account(personId)` query answers. An absent cookie
 * is an anonymous visitor, not an error - pages degrade to their signed-out state rather than
 * inventing a session.
 */
export const readSessionToken = async (): Promise<string | null> =>
    (await cookies()).get(SESSION_COOKIE)?.value ?? null

/** The person id the sign-in flow recorded beside the token, or null for an anonymous visitor. */
export const readSessionPerson = async (): Promise<string | null> =>
    (await cookies()).get(PERSON_COOKIE)?.value ?? null

/**
 * The cookie's lifetime: a mirror of the identity service's default TTL
 * (`IDENTITY_SESSION_TTL_SECONDS`, one hour). A cookie that outlives its session is harmless - the
 * verify door still refuses the dead token and the surface settles as anonymous.
 */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60

/**
 * The attributes the session door applies when it writes or clears the pair onto a response.
 * Host-only by default; `secure` stays off because the dev topology is plain `http://localhost`,
 * and `SHOP_SESSION_COOKIE_SECURE` re-enables it where HTTPS terminates.
 */
export const SESSION_COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    domain: process.env.SHOP_SESSION_COOKIE_DOMAIN,
    secure: process.env.SHOP_SESSION_COOKIE_SECURE === "true",
} as const
