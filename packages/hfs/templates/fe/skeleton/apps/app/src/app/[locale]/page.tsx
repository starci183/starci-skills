import { AppHomePage } from "@/features/pages/AppHomePage"

/** The document title of this page, from the catalog of the requested locale. */
export { appHomeMetadata as generateMetadata } from "@/features/pages/AppHomePage"

/** The locale root's page slot: it mounts the product app's home page and nothing else. */
const Page = () => <AppHomePage />

export default Page
