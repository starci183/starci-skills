import "server-only"
import { readProjectedOrigins } from "@ecommerce/api"

/**
 * Deployment facts the landing site reads but does not decide, mirroring `apps/app`'s config module: a
 * component never touches `process.env` directly, so pointing the teaser's "Enter shop" link at a different
 * host is one edit here.
 *
 * The shop is this example's *own* second app, not a backend service, and its port is read from the
 * product's resolved projection (`.starcistacks/dev/infra/metadata.json`, `ports.app`)
 * exactly the way the backend services read theirs - `NEXT_PUBLIC_SHOP_URL` names it outright, the
 * projection (`ECOMMERCE_APP_METADATA` injects its path) decides otherwise. No literal port exists in
 * this repository to drift against the allocation.
 */

/** Origin of the authenticated shop app this site hands visitors off to; read per call, never when the module loads (an image build has no projection). */
export const shopUrl = (): string =>
    process.env.NEXT_PUBLIC_SHOP_URL ?? readProjectedOrigins(process.env.ECOMMERCE_APP_METADATA).app
