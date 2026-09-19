/**
 * THE SETTLED SESSION CARRIER — the landing → shop handoff, concretely.
 *
 * `identity`'s `signIn` mutation mints an opaque bearer token; this app carries it in one httpOnly
 * cookie named `northwind-session`, with the person it authenticated beside it in
 * `northwind-person` (the shop asks identity `account(personId)` for who this is - the token
 * itself stays an opaque bearer and is never decoded). Cookies do not bind to a port, so a session
 * opened through the shop (`:4069`) accompanies the browser to the landing (`:3069`) and back on
 * `localhost` - the handoff is the browser carrying the cookie, never a token in a URL. A
 * deployment that serves the two apps on separate hostnames keeps the identical contract by
 * setting `SHOP_SESSION_COOKIE_DOMAIN` to the shared parent domain.
 *
 * Both halves are `httpOnly`: nothing in page JavaScript may read or write them, so they are set
 * and cleared only by the app's own `/api/session` door (app/api/session/route.ts) and read only
 * by server code (./index.ts). `SameSite=Lax` keeps them off cross-site POSTs.
 */
export const SESSION_COOKIE = "northwind-session"
/** The person id the session authenticated, carried beside the bearer so server reads can name who without a second hop. */
export const PERSON_COOKIE = "northwind-person"
