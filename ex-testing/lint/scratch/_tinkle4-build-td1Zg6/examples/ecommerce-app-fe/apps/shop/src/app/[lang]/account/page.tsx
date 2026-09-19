import { AccountPage } from "../../../components/pages/AccountPage"

/**
 * Server-rendered on every request: identity and orders are the services' data, so a build must
 * never bake them (and must never reach the network). `force-dynamic` keeps `next build` from
 * prerendering the reads while the services are (legitimately) not up.
 */
export const dynamic = "force-dynamic"

/** Mount the connected account page and nothing else; the page owns the reads. */
const Page = () => <AccountPage />

export default Page
