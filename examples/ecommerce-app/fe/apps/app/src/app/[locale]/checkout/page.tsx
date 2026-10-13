import { CheckoutPage } from "../../../features/pages/CheckoutPage"
import { pageMetadata } from "../../../modules/meta"

/** Rendered per request (the locale is the request's); the page reads the order and identity services from the browser. */
export const dynamic = "force-dynamic"

/** The document title of this page, from the catalog of the requested locale. */
export const generateMetadata = () => pageMetadata("shop.checkout")

/** Mount the connected page and nothing else; the page owns its reads through its hooks. */
const Page = () => <CheckoutPage />

export default Page
