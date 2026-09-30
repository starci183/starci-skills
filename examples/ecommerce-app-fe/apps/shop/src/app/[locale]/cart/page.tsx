import { CartPage } from "../../../features/pages/CartPage"
import { pageMetadata } from "../../../modules/meta"

/** Server-rendered on every request: the page's data is the order and identity services', never build-time content. */
export const dynamic = "force-dynamic"

/** The document title of this page, from the catalog of the requested locale. */
export const generateMetadata = () => pageMetadata("shop.cart")

/** Mount the connected page and nothing else; the page owns its reads. */
const Page = () => <CartPage />

export default Page
