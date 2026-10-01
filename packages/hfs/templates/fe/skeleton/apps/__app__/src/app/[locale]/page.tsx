import { HomePage, homeMetadata } from "@/features/pages/HomePage"

/** The document title of this page, from the catalog of the requested locale. */
export const generateMetadata = homeMetadata

/** The locale root's page slot: it mounts the home page and nothing else. */
const Page = () => <HomePage />

export default Page
