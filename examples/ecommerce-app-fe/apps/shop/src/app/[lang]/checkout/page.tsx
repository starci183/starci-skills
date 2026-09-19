import { CheckoutPage } from "../../../components/pages/CheckoutPage"

/**
 * Server-rendered on every request: the checkout summary is the order service's session-guarded
 * `cart` read, not build-time content, so a build must never bake it (and must never reach the
 * network). `force-dynamic` keeps `next build` from prerendering the fetch while the service is
 * (legitimately) not up. The confirmation itself rides the page's server action to `placeOrder`.
 */
export const dynamic = "force-dynamic"

/** Mount the connected checkout page and nothing else; the page owns the read. */
const Page = () => <CheckoutPage />

export default Page
