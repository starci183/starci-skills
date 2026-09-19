import { CartPage } from "../../../components/pages/CartPage"

/**
 * Server-rendered on every request: the cart is the order service's session-guarded `cart` read
 * (the `northwind-session` cookie, modules/session), not build-time content - `force-dynamic`
 * keeps `next build` from prerendering the fetch while the service is (legitimately) not up. No
 * client-side cart store is kept.
 */
export const dynamic = "force-dynamic"

const Page = () => <CartPage />

export default Page
