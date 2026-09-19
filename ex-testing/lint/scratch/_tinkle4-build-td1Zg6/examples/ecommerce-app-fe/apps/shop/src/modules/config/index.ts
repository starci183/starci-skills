import "server-only"
import { readProjectedPorts } from "./projection"

/**
 * Backend endpoints the shop talks to, read once.
 *
 * A component or page never touches `process.env` and never hardcodes a host: each service base URL is one
 * `NEXT_PUBLIC_*_API_URL` env override, and the fallback is the product's resolved projection
 * (`ecommerce-app-be/metadata.json`, `ports.orderApi`/`ports.identityApi`) - the same file the backend
 * services boot from, so no literal port exists in this repository to drift against the allocation.
 * Point the shop at a deployed stack by setting the env vars; the fallback only ever serves local
 * development and always resolves to the allocation.
 */

/** Order service: catalogue reads and the cart/checkout/orders writes behind them. */
export const ORDER_API_URL =
  process.env.NEXT_PUBLIC_ORDER_API_URL ?? `http://localhost:${readProjectedPorts().orderApi}`

/** Identity service: who the shopper is. Consumed only where the auth contract below is filled in. */
export const IDENTITY_API_URL =
  process.env.NEXT_PUBLIC_IDENTITY_API_URL ?? `http://localhost:${readProjectedPorts().identityApi}`

/** How long a server-rendered read waits before the page falls back to its empty state. */
export const REQUEST_TIMEOUT_MS = 2500
