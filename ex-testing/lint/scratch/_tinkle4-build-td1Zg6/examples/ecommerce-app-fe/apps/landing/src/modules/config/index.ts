import "server-only"
import { readProjectedPorts } from "./projection"

/**
 * Deployment facts the landing site reads but does not decide, mirroring `apps/shop`'s config module and
 * nivo-fe's own `modules/config`: a component never touches `process.env` directly, so pointing the teaser's
 * "Enter shop" link at a different host is one edit here.
 *
 * The shop is this example's *own* second app, not a backend service, and its port is read from the
 * product's resolved projection (`ecommerce-app-be/metadata.json`, `ports.shop`) exactly the way the
 * backend services read theirs - `NEXT_PUBLIC_SHOP_URL` overrides it outright, the projection is the
 * fallback. No literal port exists in this repository to drift against the allocation.
 */

/** Origin of the authenticated shop app this site hands visitors off to. */
export const SHOP_URL = process.env.NEXT_PUBLIC_SHOP_URL ?? `http://localhost:${readProjectedPorts().shop}`
