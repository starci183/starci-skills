import { randomUUID } from "node:crypto"

/**
 * The idempotency key one rendered checkout carries: a nonce minted at render time, held by the
 * confirm control for as long as that render lives. The order service scopes replay by
 * (person, key), so a repeat press on the SAME render re-sends the same key and the service
 * returns the first confirmation marked as a replay instead of writing a second order - while a
 * fresh render (a new visit, a changed cart) mints a new key and is a genuinely new order.
 *
 * The key is deliberately NOT a digest of the cart: two different purchases can hold identical
 * lines, and a content key would replay yesterday's order against today's cart - the service
 * would answer "replayed" for an order this attempt never placed, and the new cart would stay
 * uncleared and unordered.
 */
export const checkoutAttemptKey = (): string => `checkout-${randomUUID()}`
