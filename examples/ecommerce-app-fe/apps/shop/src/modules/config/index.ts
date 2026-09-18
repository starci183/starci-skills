/**
 * Backend endpoints the shop talks to, read once.
 *
 * A component or page never touches `process.env` and never hardcodes a host: each service base URL is one
 * `NEXT_PUBLIC_*_API_URL` with a localhost fallback literal set to the port this example is allocated
 * (offset 69: `order` -> 6070, `identity` -> 5070). Point the shop at a deployed stack by setting the env
 * var; the fallback only ever serves local development and matches the allocation exactly.
 */

/** Order service: catalogue reads and the cart/checkout/orders writes behind them. */
export const ORDER_API_URL = process.env.NEXT_PUBLIC_ORDER_API_URL ?? 'http://localhost:6070';

/** Identity service: who the shopper is. Consumed only where the auth contract below is filled in. */
export const IDENTITY_API_URL = process.env.NEXT_PUBLIC_IDENTITY_API_URL ?? 'http://localhost:5070';

/** How long a server-rendered read waits before the page falls back to its empty state. */
export const REQUEST_TIMEOUT_MS = 2500;
