/**
 * Deployment facts the landing site reads but does not decide, mirroring `apps/shop`'s config module and
 * nivo-fe's own `modules/config`: a component never touches `process.env` directly, so pointing the teaser's
 * "Enter shop" link at a different host is one edit here.
 *
 * The shop is this example's *own* second app (offset 69, app slot 1 -> 4069), not a backend service, so the
 * localhost fallback is the shop's allocated dev port rather than a `NEXT_PUBLIC_*_API_URL` service contract.
 */

/** Origin of the authenticated shop app this site hands visitors off to. */
export const SHOP_URL = process.env.NEXT_PUBLIC_SHOP_URL ?? 'http://localhost:4069';
