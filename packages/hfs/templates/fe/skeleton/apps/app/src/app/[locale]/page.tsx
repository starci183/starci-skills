import { AppHomePage, appHomeMetadata } from "@/features/pages/AppHomePage"

/** The document title of this page, from the catalog of the requested locale. */
export const generateMetadata = appHomeMetadata

/** The locale root's page slot: it mounts the product app's home page and nothing else. */
const Page = () => <AppHomePage />

export default Page
