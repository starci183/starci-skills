import { LandingPage } from "@/features/pages/LandingPage"

/** The document title of this page, from the catalog of the requested locale. */
export { landingMetadata as generateMetadata } from "@/features/pages/LandingPage"

/** The locale root's page slot: it mounts the landing page and nothing else. */
const Page = () => <LandingPage />

export default Page
