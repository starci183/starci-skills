import { BrowsePage } from "../../../components/pages/BrowsePage"

/**
 * Server-rendered on every request: the catalogue is the order service's data, not build-time
 * content, so a build must never bake it (and must never reach the network). `force-dynamic` keeps
 * `next build` from prerendering this fetch while the service is (legitimately) not up. The result
 * - payload or refusal - crosses into the page verbatim.
 */
export const dynamic = "force-dynamic"

/** Mount the connected browse page and nothing else; the page owns the read. */
const Page = () => <BrowsePage />

export default Page
