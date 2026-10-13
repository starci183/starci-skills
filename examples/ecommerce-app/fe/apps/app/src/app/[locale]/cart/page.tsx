import { CartPage } from "../../../features/pages/CartPage"
import { pageMetadata } from "../../../modules/meta"

/** Rendered per request (the locale is the request's); the page reads the order and identity services from the browser. */
export const dynamic = "force-dynamic"

/** The document title of this page, from the catalog of the requested locale. */
export const generateMetadata = () => pageMetadata("shop.cart")

/** Mount the connected page and nothing else; the page owns its reads through its hooks. */
const Page = () => <CartPage />

export default Page
