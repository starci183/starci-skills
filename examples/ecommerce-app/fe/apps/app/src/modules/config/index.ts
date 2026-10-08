import "server-only"
import { readProjectedOrigins } from "@ecommerce/api"

/**
 * Backend endpoints the shop talks to, and the facts of its session cookie; the endpoints are read when a request needs them.
 *
 * A component or page never touches `process.env` and never hardcodes a host: each service base URL is one
 * `NEXT_PUBLIC_*_API_URL` env value, and the fallback is the product's resolved projection
 * (`.starcistacks/dev/infra/metadata.json`, `ports.orderApi`/`ports.identityApi`) - the
 * same file the backend services boot from, so no literal port exists in this repository to drift against
 * the allocation. `ECOMMERCE_APP_METADATA` injects the projection's path when a deployment or a test
 * needs to. Point the shop at a deployed stack by setting the env vars.
 */

/** Order service: catalogue reads and the cart/checkout/orders writes behind them; read per call, never when the module loads (an image build has no projection). */
export const orderApiUrl = (): string =>
    process.env.NEXT_PUBLIC_ORDER_API_URL ?? readProjectedOrigins(process.env.ECOMMERCE_APP_METADATA).orderApi

/** Identity service: who the shopper is; read per call like the order service. */
export const identityApiUrl = (): string =>
    process.env.NEXT_PUBLIC_IDENTITY_API_URL ?? readProjectedOrigins(process.env.ECOMMERCE_APP_METADATA).identityApi

/** The parent domain the session cookie is shared on when the two apps are served on separate hostnames; host-only when unset. */
export const SESSION_COOKIE_DOMAIN: string | undefined = process.env.SHOP_SESSION_COOKIE_DOMAIN

/** Whether the session cookie is `secure`; off because the dev topology is plain `http://localhost`, on where HTTPS terminates. */
export const SESSION_COOKIE_SECURE: boolean = process.env.SHOP_SESSION_COOKIE_SECURE === "true"
